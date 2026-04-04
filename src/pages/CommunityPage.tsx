import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  MoreVertical,
  Pencil,
  Trash2,
  Lock,
  ExternalLink,
  Paperclip,
  BarChart3,
  X,
  Plus,
} from 'lucide-react';
import {
  Button,
  Spinner,
  EmptyState,
} from '../components/index.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { channels as channelApi, account as accountApi } from '../lib/api/endpoints.ts';
import { useEchoWebSocket } from '../hooks/useEchoWebSocket.ts';
import { trackEvent } from '../lib/analytics.ts';
import type { Channel, ChannelMessage, WsEchoEvent } from '../types/api.ts';

const MAX_MESSAGE_LENGTH = 2000;

export function CommunityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);

  const [discordLinked, setDiscordLinked] = useState<boolean | null>(null);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Edit/delete/report state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const isFreeUser = user?.subscription_tier === 'Free';

  // Unread tracking — localStorage-backed per-channel last-seen message ID.
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set());

  const getLastSeen = (channelId: string): string | null =>
    localStorage.getItem(`community_lastSeen_${channelId}`);

  const markChannelRead = useCallback((channelId: string, latestMessageId: string) => {
    localStorage.setItem(`community_lastSeen_${channelId}`, latestMessageId);
    setUnreadChannels((prev) => {
      if (!prev.has(channelId)) return prev;
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });
  }, []);

  // Load channels + Discord link status
  useEffect(() => {
    void accountApi.discordStatus()
      .then((s) => { setDiscordLinked(s.linked); setDiscordUsername(s.discord_username ?? null); })
      .catch(() => setDiscordLinked(false));

    const load = async () => {
      setIsLoadingChannels(true);
      try {
        const chs = await channelApi.list();
        setChannelList(chs);

        // Check each channel for unread messages.
        const unread = new Set<string>();
        await Promise.all(
          chs.map(async (ch) => {
            try {
              const msgs = await channelApi.messages(ch.channel_id, { limit: 1 });
              if (msgs.length > 0) {
                const lastSeen = getLastSeen(ch.channel_id);
                if (lastSeen === null) {
                  // First visit — seed the last-seen so everything isn't marked NEW.
                  localStorage.setItem(`community_lastSeen_${ch.channel_id}`, msgs[0]!.message_id);
                } else if (lastSeen !== msgs[0]!.message_id) {
                  unread.add(ch.channel_id);
                }
              }
            } catch { /* ignore */ }
          }),
        );
        setUnreadChannels(unread);

        if (chs.length > 0 && !activeChannel) {
          setActiveChannel(chs[0]!);
          trackEvent('community.channel_joined', { channel_id: chs[0]!.channel_id });
        }
      } finally {
        setIsLoadingChannels(false);
      }
    };
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load messages when channel changes
  const loadMessages = useCallback(async () => {
    if (!activeChannel) return;
    setIsLoadingMessages(true);
    try {
      const msgs = await channelApi.messages(activeChannel.channel_id, { limit: 50 });
      setMessages(msgs);
      // Mark channel as read when messages are viewed.
      if (msgs.length > 0) {
        markChannelRead(activeChannel.channel_id, msgs[msgs.length - 1]!.message_id);
      }
    } finally {
      setIsLoadingMessages(false);
    }
  }, [activeChannel, markChannelRead]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Real-time updates via WebSocket — refresh on new messages/edits/deletes.
  const wsPath = activeChannel ? `/ws/channels/${activeChannel.channel_id}/stream` : null;

  const handleWsEvent = useCallback(
    (event: WsEchoEvent) => {
      if (
        event.type === 'CommunityMessagePosted' ||
        event.type === 'CommunityMessageEdited' ||
        event.type === 'CommunityMessageDeleted'
      ) {
        void loadMessages();
      }
    },
    [loadMessages],
  );

  useEchoWebSocket(wsPath, handleWsEvent, loadMessages);

  // Global community stream — marks non-active channels as unread in real-time.
  // Use a ref for activeChannel so the callback is stable and doesn't cause WS reconnects.
  const activeChannelRef = useRef(activeChannel);
  activeChannelRef.current = activeChannel;

  const handleCommunityEvent = useCallback(
    (event: WsEchoEvent) => {
      if (event.type === 'CommunityMessagePosted') {
        const channelId = (event as { channel_id: string }).channel_id;
        const current = activeChannelRef.current;
        // Don't mark the active channel as unread — the user is already viewing it.
        if (current && channelId === current.channel_id) return;
        setUnreadChannels((prev) => {
          if (prev.has(channelId)) return prev;
          const next = new Set(prev);
          next.add(channelId);
          return next;
        });
      }
    },
    [], // Stable — no deps, uses ref for activeChannel
  );

  useEchoWebSocket('/ws/community/stream', handleCommunityEvent);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!activeChannel || !messageText.trim() || isSending) return;
    setIsSending(true);
    try {
      const msg = await channelApi.sendMessage(activeChannel.channel_id, {
        content: messageText.trim(),
      });
      trackEvent('community.message_sent', { channel_id: activeChannel.channel_id, message_length: messageText.trim().length });
      setMessages((prev) => [...prev, msg]);
      setMessageText('');
    } catch {
      addToast(t('common.error'), 'danger');
    } finally {
      setIsSending(false);
    }
  };

  const handleEdit = async (messageId: string) => {
    if (!activeChannel || !editText.trim()) return;
    try {
      const updated = await channelApi.editMessage(
        activeChannel.channel_id,
        messageId,
        { content: editText.trim() },
      );
      setMessages((prev) =>
        prev.map((m) => (m.message_id === messageId ? updated : m)),
      );
      setEditingMessageId(null);
      addToast(t('community.messageEdited'), 'success');
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!activeChannel) return;
    try {
      await channelApi.deleteMessage(activeChannel.channel_id, messageId);
      setMessages((prev) => prev.filter((m) => m.message_id !== messageId));
      addToast(t('community.messageDeleted'), 'success');
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!activeChannel) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast(t('community.fileTooLarge'), 'danger');
      return;
    }
    if (!file.type.startsWith('image/')) {
      addToast(t('community.onlyImages'), 'danger');
      return;
    }
    setIsSending(true);
    try {
      const msg = await channelApi.uploadImage(activeChannel.channel_id, file);
      setMessages((prev) => [...prev, msg]);
    } catch {
      addToast(t('common.error'), 'danger');
    } finally {
      setIsSending(false);
    }
  };

  const handlePollVote = async (msg: ChannelMessage, answerId: number) => {
    if (!activeChannel || !msg.poll_data) return;
    try {
      const poll: import('../types/api.ts').PollData = JSON.parse(msg.poll_data);
      await channelApi.pollVote(activeChannel.channel_id, {
        discord_message_id: poll.discord_message_id,
        discord_channel_id: poll.discord_channel_id,
        answer_id: answerId,
      });
      addToast(t('community.voteRecorded'), 'success');
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleCreatePoll = async () => {
    if (!activeChannel || !pollQuestion.trim()) return;
    const validOptions = pollOptions.filter((o) => o.trim());
    if (validOptions.length < 2) return;
    setIsSending(true);
    try {
      await channelApi.createPoll(activeChannel.channel_id, {
        question: pollQuestion.trim(),
        options: validOptions.map((o) => o.trim()),
      });
      setShowPollForm(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      void loadMessages();
    } catch {
      addToast(t('common.error'), 'danger');
    } finally {
      setIsSending(false);
    }
  };

  // Edit/delete eligibility is computed server-side and returned on each message.
  // Source: crates/api/src/routes/channels.rs MessageResponse::from_message().
  const canEditMessage = (msg: ChannelMessage) => msg.can_edit ?? false;
  const canDeleteMessage = (msg: ChannelMessage) => msg.can_delete ?? false;

  return (
    <>
    <div className="flex h-full flex-1 overflow-hidden">
        {/* Channel sidebar */}
        <div className="w-60 shrink-0 overflow-y-auto border-r border-border bg-surface p-3">
          <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t('community.channels')}
          </h2>
          <p className="mb-3 px-2 text-xs text-text-muted">
            {t('community.poweredByDiscord')}
          </p>
          {discordLinked === false && (
            <button
              onClick={() => navigate('/settings?tab=account')}
              className="mb-3 flex w-full items-center gap-2 rounded-lg bg-[#5865F2] px-3 py-2.5 text-left text-sm font-medium text-white shadow-sm hover:bg-[#4752C4] transition-colors"
            >
              <ExternalLink size={14} />
              {t('community.linkDiscord')}
            </button>
          )}
          {discordLinked && discordUsername && (
            <p className="mb-3 px-2 text-xs text-success">
              {t('community.discordConnected', { username: discordUsername })}
            </p>
          )}
          {isLoadingChannels ? (
            <Spinner size="sm" />
          ) : channelList.length === 0 ? (
            <div className="px-2">
              <p className="text-xs text-text-muted">{t('community.noChannelsDesc')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {channelList.map((ch) => (
                <button
                  key={ch.channel_id}
                  onClick={() => setActiveChannel(ch)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    activeChannel?.channel_id === ch.channel_id
                      ? 'border-accent/50 bg-accent/10 ring-2 ring-accent/25'
                      : 'border-accent/20 bg-accent/5 hover:border-accent/40 hover:bg-accent/10'
                  }`}
                  aria-current={activeChannel?.channel_id === ch.channel_id ? 'true' : undefined}
                >
                  <span className={`flex items-center gap-2 text-sm font-medium ${
                    activeChannel?.channel_id === ch.channel_id
                      ? 'text-accent'
                      : 'text-text-primary'
                  }`}>
                    {ch.name}
                    {unreadChannels.has(ch.channel_id) && activeChannel?.channel_id !== ch.channel_id && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-canvas">
                        {t('community.new')}
                      </span>
                    )}
                  </span>
                  {ch.description && (
                    <span className="mt-0.5 block text-[11px] leading-snug text-text-secondary">
                      {ch.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message area */}
        <div className="flex flex-1 flex-col">
          {!activeChannel ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                title={t('community.selectChannel')}
                description=""
              />
            </div>
          ) : (
            <>
              {/* Channel header */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-text-primary">
                  {activeChannel.name}
                </h2>
                {activeChannel.description && (
                  <span className="text-xs text-text-muted">
                    — {activeChannel.description}
                  </span>
                )}
              </div>

              {/* Messages */}
              <div
                className="flex-1 overflow-y-auto px-4 py-3"
                role="log"
                aria-live="polite"
                aria-label={t('community.title')}
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-10">
                    <Spinner size="md" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-text-muted">
                    {t('community.noMessagesYet')}
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {messages.map((msg, idx) => {
                      const prev = idx > 0 ? messages[idx - 1] : null;
                      const sameAuthor = prev !== null && prev.author_id === msg.author_id;
                      const withinWindow =
                        sameAuthor &&
                        Math.abs(new Date(msg.created_at).getTime() - new Date(prev!.created_at).getTime()) < 7 * 60 * 1000;
                      const showHeader = !withinWindow;
                      const displayName = msg.author_display_name || 'Unknown User';
                      const initial = displayName[0]?.toUpperCase() ?? '?';
                      const timeStr = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                      <div
                        key={msg.message_id}
                        className={`group/msg relative rounded-lg px-3 hover:bg-surface-raised ${showHeader ? 'mt-4 pt-2 pb-1' : 'py-0.5 pl-12'}`}
                      >
                        {editingMessageId === msg.message_id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              maxLength={MAX_MESSAGE_LENGTH}
                              aria-label={t('community.editMessageLabel')}
                              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void handleEdit(msg.message_id);
                                if (e.key === 'Escape') setEditingMessageId(null);
                              }}
                              // eslint-disable-next-line jsx-a11y/no-autofocus -- editing inline requires immediate focus
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              onClick={() => void handleEdit(msg.message_id)}
                            >
                              {t('common.save')}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setEditingMessageId(null)}
                            >
                              {t('common.cancel')}
                            </Button>
                          </div>
                        ) : (
                          <>
                            {showHeader ? (
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                                  {initial}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-sm font-medium text-accent">
                                      {displayName}
                                    </span>
                                    <span className="text-xs text-text-muted">
                                      {timeStr}
                                    </span>
                                    {msg.is_edited && (
                                      <span className="text-xs text-text-muted">{t('common.edited')}</span>
                                    )}
                                  </div>
                                  {msg.content && (
                                    <p className="text-sm text-text-primary">{msg.content}</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="group/line flex items-start">
                                <span className="mr-3 mt-0.5 hidden w-8 shrink-0 text-center text-[10px] text-text-muted group-hover/line:inline">
                                  {timeStr}
                                </span>
                                {msg.content && (
                                  <p className="text-sm text-text-primary">{msg.content}</p>
                                )}
                              </div>
                            )}
                            {msg.image_url && (
                              <button
                                onClick={() => setExpandedImage(msg.image_url)}
                                className="mt-1 block"
                              >
                                <img
                                  src={msg.image_url}
                                  alt={t('community.sharedImage')}
                                  className="max-h-48 max-w-xs rounded-lg border border-border object-cover hover:opacity-90 transition-opacity"
                                />
                              </button>
                            )}
                            {msg.poll_data && (() => {
                              try {
                                const poll: import('../types/api.ts').PollData = JSON.parse(msg.poll_data!);
                                const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
                                return (
                                  <div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                                    <p className="mb-2 text-sm font-semibold text-text-primary">{poll.question}</p>
                                    <div className="flex flex-col gap-1.5">
                                      {poll.options.map((opt) => (
                                        <button
                                          key={opt.id}
                                          onClick={() => void handlePollVote(msg, opt.id)}
                                          className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary hover:border-accent hover:bg-accent/10 transition-colors"
                                        >
                                          <span>{opt.text}</span>
                                          <span className="ml-2 text-xs text-text-muted">
                                            {opt.votes} {t('community.votes')}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                    <p className="mt-1.5 text-xs text-text-muted">
                                      {t('community.totalVotes', { count: totalVotes })}
                                    </p>
                                  </div>
                                );
                              } catch { return null; }
                            })()}

                            {/* Message actions */}
                            <div className="absolute right-2 top-2 hidden group-hover:flex">
                              <button
                                onClick={() =>
                                  setMenuOpenId(
                                    menuOpenId === msg.message_id ? null : msg.message_id,
                                  )
                                }
                                className="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary"
                                aria-label={t('common.messageActions')}
                              >
                                <MoreVertical size={14} />
                              </button>
                              {menuOpenId === msg.message_id && (
                                <div className="absolute right-0 top-7 z-10 min-w-[140px] rounded-lg border border-border bg-surface py-1 shadow-lg">
                                  {canEditMessage(msg) && (
                                    <button
                                      onClick={() => {
                                        setEditingMessageId(msg.message_id);
                                        setEditText(msg.content);
                                        setMenuOpenId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-raised"
                                    >
                                      <Pencil size={12} /> {t('common.edit')}
                                    </button>
                                  )}
                                  {canDeleteMessage(msg) && (
                                    <button
                                      onClick={() => {
                                        void handleDelete(msg.message_id);
                                        setMenuOpenId(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-danger hover:bg-surface-raised"
                                    >
                                      <Trash2 size={12} /> {t('common.delete')}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Poll creation form */}
              {showPollForm && !activeChannel.is_read_only && (
                <div className="border-t border-border px-4 py-3">
                  <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-accent">
                      {t('community.createPoll')}
                    </p>
                    <input
                      type="text"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder={t('community.pollQuestion')}
                      maxLength={300}
                      className="mb-2 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                    />
                    {pollOptions.map((opt, i) => (
                      <input
                        key={i}
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const next = [...pollOptions];
                          next[i] = e.target.value;
                          setPollOptions(next);
                        }}
                        placeholder={t('community.pollOption', { n: i + 1 })}
                        maxLength={55}
                        className="mb-1 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                      />
                    ))}
                    <div className="mt-2 flex items-center gap-2">
                      {pollOptions.length < 4 && (
                        <button
                          onClick={() => setPollOptions([...pollOptions, ''])}
                          className="flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <Plus size={12} /> {t('community.addOption')}
                        </button>
                      )}
                      <div className="ml-auto flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => { setShowPollForm(false); setPollQuestion(''); setPollOptions(['', '']); }}
                        >
                          {t('common.cancel')}
                        </Button>
                        <Button
                          onClick={() => void handleCreatePoll()}
                          disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2 || isSending}
                        >
                          {t('community.createPollBtn')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Composer */}
              <div className="border-t border-border px-4 py-3">
                {activeChannel.is_read_only ? (
                  <p className="py-1 text-center text-xs text-text-muted">
                    {t('community.announcementsOnly')}
                  </p>
                ) : isFreeUser ? (
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Lock size={14} aria-hidden="true" />
                    {t('community.readOnly')}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleImageUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSending}
                      className="rounded-lg p-2 text-[#5865F2] hover:bg-[#5865F2]/10 transition-colors"
                      aria-label={t('community.uploadImage')}
                      title={t('community.uploadImage')}
                    >
                      <Paperclip size={18} />
                    </button>
                    <button
                      onClick={() => setShowPollForm(!showPollForm)}
                      disabled={isSending}
                      className={`rounded-lg p-2 transition-colors ${
                        showPollForm
                          ? 'bg-accent/20 text-accent'
                          : 'text-emerald-500 hover:bg-emerald-500/10'
                      }`}
                      aria-label={t('community.createPoll')}
                      title={t('community.createPoll')}
                    >
                      <BarChart3 size={18} />
                    </button>
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      maxLength={MAX_MESSAGE_LENGTH}
                      placeholder={t('community.messagePlaceholder')}
                      className="flex-1 rounded-lg border-2 border-accent/30 bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      aria-label={t('community.messagePlaceholder')}
                    />
                    <span className="text-xs text-text-muted">
                      {t('community.charCount', {
                        count: messageText.length,
                        max: MAX_MESSAGE_LENGTH,
                      })}
                    </span>
                    <Button
                      onClick={() => void handleSend()}
                      disabled={!messageText.trim() || isSending}
                    >
                      <Send size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Expanded Image Overlay */}
      {expandedImage && (
        <button
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpandedImage(null)}
          aria-label={t('community.closeImage')}
        >
          <span
            className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
            aria-hidden="true"
          >
            <X size={20} />
          </span>
          <img
            src={expandedImage}
            alt={t('community.sharedImage')}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </button>
      )}
    </>
  );
}

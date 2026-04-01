import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Send,
  ExternalLink,
  Paperclip,
  BarChart3,
  ChevronDown,
} from 'lucide-react';
import { Button, Spinner, ReportButton } from './index.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { channels as channelApi, account as accountApi } from '../lib/api/endpoints.ts';
import { useEchoWebSocket } from '../hooks/useEchoWebSocket.ts';
import type { Channel, ChannelMessage, WsEchoEvent, PollData } from '../types/api.ts';

const MAX_MESSAGE_LENGTH = 2000;

function DiscordIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 5a.2.2 0 00-.1 0C1.5 18.7-.9 32 .3 45.2v.1a58.9 58.9 0 0018 9.1.2.2 0 00.3-.1 42.2 42.2 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.3 47.3 0 003.6 5.9.2.2 0 00.3.1A58.7 58.7 0 0071 45.3v-.1C72.4 30 68.4 16.8 60.1 5a.2.2 0 00-.1 0zM23.7 37.1c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1z" fill="currentColor"/>
    </svg>
  );
}

export function CommunitySidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);

  const [discordLinked, setDiscordLinked] = useState<boolean | null>(null);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeChannelRef = useRef(activeChannel);
  activeChannelRef.current = activeChannel;

  const isFreeUser = user?.subscription_tier === 'Free';

  // Restore last active channel from localStorage.
  const savedChannelId = localStorage.getItem('community_sidebar_channel');

  useEffect(() => {
    void accountApi.discordStatus()
      .then((s) => { setDiscordLinked(s.linked); setDiscordUsername(s.discord_username ?? null); })
      .catch(() => setDiscordLinked(false));

    const load = async () => {
      try {
        const chs = await channelApi.list();
        setChannelList(chs);
        const saved = chs.find((c) => c.channel_id === savedChannelId);
        if (saved) {
          setActiveChannel(saved);
        } else if (chs.length > 0) {
          setActiveChannel(chs[0]!);
        }
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = useCallback(async () => {
    if (!activeChannel) return;
    try {
      const msgs = await channelApi.messages(activeChannel.channel_id, { limit: 30 });
      setMessages(msgs);
      // Mark as read.
      if (msgs.length > 0) {
        localStorage.setItem(
          `community_lastSeen_${activeChannel.channel_id}`,
          msgs[msgs.length - 1]!.message_id,
        );
      }
    } catch { /* ignore */ }
  }, [activeChannel]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Save active channel to localStorage.
  useEffect(() => {
    if (activeChannel) {
      localStorage.setItem('community_sidebar_channel', activeChannel.channel_id);
    }
  }, [activeChannel]);

  // Auto-scroll.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Per-channel WS.
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

  // Unread tracking via global community WS.
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set());
  const handleCommunityEvent = useCallback(
    (event: WsEchoEvent) => {
      if (event.type === 'CommunityMessagePosted') {
        const channelId = (event as { channel_id: string }).channel_id;
        const current = activeChannelRef.current;
        if (current && channelId === current.channel_id) return;
        setUnreadChannels((prev) => {
          if (prev.has(channelId)) return prev;
          const next = new Set(prev);
          next.add(channelId);
          return next;
        });
      }
    },
    [],
  );
  useEchoWebSocket('/ws/community/stream', handleCommunityEvent);

  // Clear unread when switching channels.
  useEffect(() => {
    if (activeChannel) {
      setUnreadChannels((prev) => {
        if (!prev.has(activeChannel.channel_id)) return prev;
        const next = new Set(prev);
        next.delete(activeChannel.channel_id);
        return next;
      });
    }
  }, [activeChannel]);

  const handleSend = async () => {
    if (!activeChannel || !messageText.trim() || isSending) return;
    setIsSending(true);
    try {
      const msg = await channelApi.sendMessage(activeChannel.channel_id, {
        content: messageText.trim(),
      });
      setMessages((prev) => [...prev, msg]);
      setMessageText('');
    } catch {
      addToast(t('common.error'), 'danger');
    } finally {
      setIsSending(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!activeChannel) return;
    if (file.size > 5 * 1024 * 1024) { addToast(t('community.fileTooLarge'), 'danger'); return; }
    if (!file.type.startsWith('image/')) { addToast(t('community.onlyImages'), 'danger'); return; }
    setIsSending(true);
    try {
      const msg = await channelApi.uploadImage(activeChannel.channel_id, file);
      setMessages((prev) => [...prev, msg]);
    } catch { addToast(t('common.error'), 'danger'); } finally { setIsSending(false); }
  };

  const handlePollVote = async (msg: ChannelMessage, answerId: number) => {
    if (!activeChannel || !msg.poll_data) return;
    try {
      const poll: PollData = JSON.parse(msg.poll_data);
      await channelApi.pollVote(activeChannel.channel_id, {
        discord_message_id: poll.discord_message_id,
        discord_channel_id: poll.discord_channel_id,
        answer_id: answerId,
      });
      addToast(t('community.voteRecorded'), 'success');
    } catch { addToast(t('common.error'), 'danger'); }
  };

  // ── Not linked CTA ──
  if (discordLinked === false) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <DiscordIcon size={48} />
        <h3 className="text-lg font-semibold text-text-primary">
          {t('communitySidebar.joinDiscord')}
        </h3>
        <p className="text-sm text-text-secondary">
          {t('communitySidebar.joinDiscordDesc')}
        </p>
        <button
          onClick={() => navigate('/settings?tab=account')}
          className="flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#4752C4] transition-colors"
        >
          <ExternalLink size={14} />
          {t('communitySidebar.linkAccount')}
        </button>
      </div>
    );
  }

  if (isLoading || discordLinked === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <DiscordIcon size={14} />
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#5865F2]">
              {t('communitySidebar.poweredBy')}
            </span>
          </div>
          {discordUsername && (
            <span className="text-[10px] text-text-muted">{discordUsername}</span>
          )}
        </div>

        {/* Channel selector dropdown */}
        <div className="relative mt-1.5">
          <button
            onClick={() => setShowChannelPicker(!showChannelPicker)}
            className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary hover:border-accent/40 transition-colors"
          >
            <span className="truncate">{activeChannel?.name ?? t('communitySidebar.selectChannel')}</span>
            <span className="flex items-center gap-1">
              {unreadChannels.size > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#5865F2] px-1 text-[9px] font-bold text-white">
                  {unreadChannels.size}
                </span>
              )}
              <ChevronDown size={14} className={`text-text-muted transition-transform ${showChannelPicker ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {showChannelPicker && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-surface py-1 shadow-lg">
              {channelList.map((ch) => (
                <button
                  key={ch.channel_id}
                  onClick={() => { setActiveChannel(ch); setShowChannelPicker(false); }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors ${
                    activeChannel?.channel_id === ch.channel_id
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-primary hover:bg-surface-raised'
                  }`}
                >
                  <span className="truncate">{ch.name}</span>
                  {unreadChannels.has(ch.channel_id) && (
                    <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none text-canvas">
                      {t('community.new')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-xs text-text-muted">
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
                <div key={msg.message_id} className={`group/msg text-xs ${showHeader && idx > 0 ? 'mt-3' : ''}`}>
                  {showHeader ? (
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-medium text-accent">{displayName}</span>
                          <span className="text-[10px] text-text-muted">{timeStr}</span>
                          <ReportButton targetType="message" targetId={msg.message_id} size={10} />
                        </div>
                        {msg.content && <p className="text-text-primary">{msg.content}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="group/line flex items-start gap-2 rounded px-0 py-px hover:bg-surface-raised">
                      <span className="mt-0.5 hidden w-6 shrink-0 text-center text-[9px] text-text-muted group-hover/line:inline">
                        {timeStr}
                      </span>
                      {msg.content && <p className="min-w-0 flex-1 text-text-primary">{msg.content}</p>}
                    </div>
                  )}
                  {msg.image_url && (
                    <button onClick={() => setExpandedImage(msg.image_url)} className="mt-0.5 block">
                      <img
                        src={msg.image_url}
                        alt={t('community.sharedImage')}
                        className="max-h-32 max-w-full rounded border border-border object-cover hover:opacity-90 transition-opacity"
                      />
                    </button>
                  )}
                  {msg.poll_data && (() => {
                    try {
                      const poll: PollData = JSON.parse(msg.poll_data!);
                      return (
                        <div className="mt-1 rounded border border-accent/30 bg-accent/5 p-2">
                          <p className="mb-1 text-xs font-semibold text-text-primary">{poll.question}</p>
                          <div className="flex flex-col gap-1">
                            {poll.options.map((opt) => (
                              <button
                                key={opt.id}
                                onClick={() => void handlePollVote(msg, opt.id)}
                                className="flex items-center justify-between rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary hover:border-accent transition-colors"
                              >
                                <span>{opt.text}</span>
                                <span className="text-text-muted">{opt.votes}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    } catch { return null; }
                  })()}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      {activeChannel && !activeChannel.is_read_only && !isFreeUser && (
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-center gap-1.5">
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
              className="rounded p-1.5 text-[#5865F2] hover:bg-[#5865F2]/10 transition-colors"
              title={t('community.uploadImage')}
            >
              <Paperclip size={14} />
            </button>
            <button
              disabled={isSending}
              className="rounded p-1.5 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
              title={t('community.createPoll')}
            >
              <BarChart3 size={14} />
            </button>
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={t('community.messagePlaceholder')}
              className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button
              onClick={() => void handleSend()}
              disabled={!messageText.trim() || isSending}
              className="!px-2 !py-1.5"
            >
              <Send size={12} />
            </Button>
          </div>
        </div>
      )}
      {activeChannel?.is_read_only && (
        <div className="border-t border-border px-3 py-2">
          <p className="text-center text-[10px] text-text-muted">{t('community.announcementsOnly')}</p>
        </div>
      )}

      {/* Expanded image overlay */}
      {expandedImage && (
        <button
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setExpandedImage(null)}
          aria-label={t('community.closeImage')}
        >
          <img
            src={expandedImage}
            alt={t('community.sharedImage')}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
        </button>
      )}

    </div>
  );
}


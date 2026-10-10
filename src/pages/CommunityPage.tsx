import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  translateCaughtError,
  isPlatformError,
} from '../lib/translateError.ts';
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
import { Button, Spinner, EmptyState } from '../components/index.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useInFlight } from '../hooks/useInFlight.ts';
import { markers } from '../lib/inFlightMarkers.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import {
  channels as channelApi,
  account as accountApi,
} from '../lib/api/endpoints.ts';
import { useEchoWebSocket } from '../hooks/useEchoWebSocket.ts';
import {
  useCurrentKey,
  useLatestLoad,
  whenCurrent,
} from '../hooks/useCurrentKey.ts';
import { trackEvent } from '../lib/analytics.ts';
import { formatTime } from '../lib/formatDate.ts';
import { sameMessageAuthor } from '../lib/messageGrouping.ts';
import type { Channel, ChannelMessage, WsEchoEvent } from '../types/api.ts';

const MAX_MESSAGE_LENGTH = 2000;

/** Shows a sent message after a channel's messages, once: a read that
 *  landed first may already hold it (R422.2). */
const appendOnce = (msg: ChannelMessage) => (prev: ChannelMessage[]) =>
  prev.some((m) => m.message_id === msg.message_id) ? prev : [...prev, msg];

export function CommunityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);

  const [discordLinked, setDiscordLinked] = useState<boolean | null>(null);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [isLoadingChannels, setIsLoadingChannels] = useState(true);
  // The messages the last load or action wrote, and the channel they are
  // in. They are shown only while that channel is the active one (R371.1):
  // the first render for another channel shows it loading, never the
  // earlier channel's messages. `loading` is true until a read of the
  // channel has landed: a reload of a channel already read keeps its
  // messages shown.
  const channelKey = activeChannel?.channel_id ?? null;
  const [held, setHeld] = useState<{
    key: string | null;
    messages: ChannelMessage[];
    loading: boolean;
  }>({ key: null, messages: [], loading: false });
  const shownMessages = held.key === channelKey ? held : null;
  const messages = useMemo(
    () => shownMessages?.messages ?? [],
    [shownMessages],
  );
  const isLoadingMessages =
    channelKey !== null && (shownMessages === null || shownMessages.loading);
  /** Shows an action's answer in channel `key`'s messages at once, until
   *  the read that follows it lands (R422.2): nothing while another
   *  channel's are held, or while no read of the channel has landed. */
  const showAnswerIn = useCallback(
    (key: string, change: (prev: ChannelMessage[]) => ChannelMessage[]) =>
      setHeld((prev) =>
        prev.key === key && !prev.loading
          ? { ...prev, messages: change(prev.messages) }
          : prev,
      ),
    [],
  );
  // Of the loads of the messages the page starts, only the last one started
  // for the active channel writes, and only while the page is mounted
  // (R361.1, R381.1). An action whose answer the page writes (a message
  // sent, an image, an edit, a delete) supersedes every load of its channel
  // started before it when it starts, and every load started while it was
  // pending by the full read of the channel it starts when it ends, so its
  // answer and then that read are the newest writes, and that read ends the
  // loading a read it superseded began (R390.3b, R422.2, R463.2). It does
  // both only while the visit to the channel it began in lasts: answered
  // or failed in a later visit, it writes nothing and reads nothing
  // (R483.1).
  const startMessages = useLatestLoad(channelKey);
  const isShownChannel = useCurrentKey(channelKey);
  // The composer's draft and its request in flight belong to the channel
  // they were typed and sent in (R422.3).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const messageText = channelKey === null ? '' : (drafts[channelKey] ?? '');
  const setDraftOf = (key: string, text: string) =>
    setDrafts((prev) => ({ ...prev, [key]: text }));
  const [sendingIn, setSendingIn] = useState<ReadonlySet<string>>(new Set());
  const isSending = channelKey !== null && sendingIn.has(channelKey);
  const setSendingOf = (key: string, sending: boolean) =>
    setSendingIn((prev) => {
      const next = new Set(prev);
      if (sending) next.add(key);
      else next.delete(key);
      return next;
    });
  const inFlight = useInFlight();

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

  const markChannelRead = useCallback(
    (channelId: string, latestMessageId: string) => {
      localStorage.setItem(`community_lastSeen_${channelId}`, latestMessageId);
      setUnreadChannels((prev) => {
        if (!prev.has(channelId)) return prev;
        const next = new Set(prev);
        next.delete(channelId);
        return next;
      });
    },
    [],
  );

  // Load channels + Discord link status
  useEffect(() => {
    void accountApi
      .discordStatus()
      .then((s) => {
        setDiscordLinked(s.linked);
        setDiscordUsername(s.discord_username ?? null);
      })
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
              const page = await channelApi.messages(ch.channel_id, {
                limit: 1,
              });
              const msgs = page.data;
              if (msgs.length > 0) {
                const lastSeen = getLastSeen(ch.channel_id);
                if (lastSeen === null) {
                  // First visit — seed the last-seen so everything isn't marked NEW.
                  localStorage.setItem(
                    `community_lastSeen_${ch.channel_id}`,
                    msgs[0]!.message_id,
                  );
                } else if (lastSeen !== msgs[0]!.message_id) {
                  unread.add(ch.channel_id);
                }
              }
            } catch {
              /* ignore */
            }
          }),
        );
        setUnreadChannels(unread);

        // This runs once, on mount, before any channel can be chosen, so
        // the first channel is the one shown.
        if (chs.length > 0) {
          setActiveChannel(chs[0]!);
          trackEvent('community.channel_joined', {
            channel_id: chs[0]!.channel_id,
          });
        }
      } finally {
        setIsLoadingChannels(false);
      }
    };
    void load();
  }, []);

  // Load messages when channel changes. A call kept from an earlier
  // channel (a live event, a poll, an action's reload) starts no load
  // (R390.3a).
  const loadMessages = useCallback(async () => {
    if (!activeChannel) return;
    const key = activeChannel.channel_id;
    const isCurrent = startMessages(key);
    if (!isCurrent()) return;
    setHeld((prev) =>
      prev.key === key ? prev : { key, messages: [], loading: true },
    );
    try {
      const page = await whenCurrent(
        isCurrent,
        channelApi.messages(key, {
          limit: 50,
        }),
      );
      const msgs = page.data;
      setHeld({ key, messages: msgs, loading: false });
      // Mark channel as read when messages are viewed.
      if (msgs.length > 0) {
        markChannelRead(key, msgs[msgs.length - 1]!.message_id);
      }
    } catch (err) {
      // A failed read keeps the channel's messages and says so.
      setHeld((prev) =>
        prev.key === key
          ? { ...prev, loading: false }
          : { key, messages: [], loading: false },
      );
      addToast(translateCaughtError(err, t('common.error')), 'danger', {
        platformLink: isPlatformError(err),
      });
    }
  }, [activeChannel, markChannelRead, startMessages, addToast, t]);

  /** Runs an action whose answer changes channel `key`'s messages. The
   *  action supersedes every load of the channel started before it when it
   *  starts (R390.3b). The answer is shown at once, when a read of the
   *  channel has landed, and the full read of the channel it starts then
   *  supersedes every load started while it was pending, so the answer and
   *  then that read are the newest writes, and the read's answer replaces
   *  the list (R422.2). An action that fails in its visit reads the channel
   *  again. A read the action superseded never ends the loading it began;
   *  the read the action starts when it ends does (R463.2). An action keeps the
   *  visit it began in: answered or failed in a later visit to the
   *  channel, it shows nothing and reads nothing there (R483.1). */
  const writeAnswer = useCallback(
    async <T,>(
      key: string,
      request: () => Promise<T>,
      write: (answer: T) => (prev: ChannelMessage[]) => ChannelMessage[],
    ): Promise<T> => {
      const shown = isShownChannel(key);
      startMessages(key);
      try {
        const answer = await request();
        if (shown()) {
          showAnswerIn(key, write(answer));
          void loadMessages();
        }
        return answer;
      } catch (err) {
        if (shown()) void loadMessages();
        throw err;
      }
    },
    [isShownChannel, startMessages, showAnswerIn, loadMessages],
  );

  useEffect(() => {
    void (async () => {
      await loadMessages();
    })();
  }, [loadMessages]);

  // Real-time updates via WebSocket — refresh on new messages/edits/deletes.
  const wsPath = activeChannel
    ? `/ws/channels/${activeChannel.channel_id}/stream`
    : null;

  const handleWsEvent = useCallback(
    (event: WsEchoEvent) => {
      if (
        event.type === 'CommunityMessagePosted' ||
        event.type === 'CommunityMessageEdited' ||
        event.type === 'CommunityMessageDeleted' ||
        // A user's messages here were anonymised: reload to show it (R217.2).
        (event.type === 'ChannelMessagesAnonymised' &&
          activeChannel !== null &&
          event.channel_ids.includes(activeChannel.channel_id))
      ) {
        void loadMessages();
      }
    },
    [activeChannel, loadMessages],
  );

  useEchoWebSocket(wsPath, handleWsEvent, loadMessages);

  // Global community stream — marks non-active channels as unread in real-time.
  // Use a ref for activeChannel so the callback is stable and doesn't cause WS reconnects.
  const activeChannelRef = useRef(activeChannel);
  // eslint-disable-next-line react-hooks/refs -- intentional render-time latest-value ref; the community-stream WS callback reads .current synchronously, so moving the write into an effect would stale it
  activeChannelRef.current = activeChannel;

  const handleCommunityEvent = useCallback(
    (event: WsEchoEvent) => {
      if (event.type === 'CommunityMessagePosted') {
        const channelId = event.channel_id;
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
    const channelId = activeChannel.channel_id;
    const content = messageText.trim();
    const shown = isShownChannel(channelId);
    setSendingOf(channelId, true);
    try {
      await writeAnswer(
        channelId,
        () => channelApi.sendMessage(channelId, { content }),
        appendOnce,
      );
      trackEvent('community.message_sent', {
        channel_id: channelId,
        message_length: content.length,
      });
      // Answered in a later visit, the send writes nothing there (R483.1).
      if (!shown()) return;
      // The draft is cleared only if it still holds what was sent: text
      // typed while the send was pending stays.
      setDrafts((prev) =>
        (prev[channelId] ?? '').trim() === content
          ? { ...prev, [channelId]: '' }
          : prev,
      );
    } catch (err) {
      if (!shown()) return;
      addToast(translateCaughtError(err, t('common.error')), 'danger', {
        platformLink: isPlatformError(err),
      });
    } finally {
      setSendingOf(channelId, false);
    }
  };

  const handleEdit = async (messageId: string) => {
    if (!activeChannel || !editText.trim()) return;
    const channelId = activeChannel.channel_id;
    const content = editText.trim();
    const shown = isShownChannel(channelId);
    await inFlight.run(markers.editMessage(messageId), async () => {
      try {
        await writeAnswer(
          channelId,
          () => channelApi.editMessage(channelId, messageId, { content }),
          (updated) => (prev) =>
            prev.map((m) => (m.message_id === messageId ? updated : m)),
        );
        if (!shown()) return;
        setEditingMessageId((id) => (id === messageId ? null : id));
        addToast(t('community.messageEdited'), 'success');
      } catch (err) {
        if (!shown()) return;
        addToast(translateCaughtError(err, t('common.error')), 'danger', {
          platformLink: isPlatformError(err),
        });
      }
    });
  };

  const handleDelete = async (messageId: string) => {
    if (!activeChannel) return;
    const channelId = activeChannel.channel_id;
    const shown = isShownChannel(channelId);
    await inFlight.run(markers.deleteMessage(messageId), async () => {
      try {
        await writeAnswer(
          channelId,
          () => channelApi.deleteMessage(channelId, messageId),
          () => (prev) => prev.filter((m) => m.message_id !== messageId),
        );
        if (!shown()) return;
        addToast(t('community.messageDeleted'), 'success');
      } catch (err) {
        if (!shown()) return;
        addToast(translateCaughtError(err, t('common.error')), 'danger', {
          platformLink: isPlatformError(err),
        });
      }
    });
  };

  // The marker holds the upload; `isSending` disables the composer while it
  // is in flight (R285.1), and the marker disables the upload button in any
  // page mounted while it is held (R294.2).
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
    const channelId = activeChannel.channel_id;
    const shown = isShownChannel(channelId);
    await inFlight.run(markers.upload('page', channelId), async () => {
      setSendingOf(channelId, true);
      try {
        await writeAnswer(
          channelId,
          () => channelApi.uploadImage(channelId, file),
          appendOnce,
        );
      } catch (err) {
        if (!shown()) return;
        addToast(translateCaughtError(err, t('common.error')), 'danger', {
          platformLink: isPlatformError(err),
        });
      } finally {
        setSendingOf(channelId, false);
      }
    });
  };

  const handlePollVote = async (msg: ChannelMessage, answerId: number) => {
    if (!activeChannel || !msg.poll_data) return;
    const channelId = activeChannel.channel_id;
    const pollData = msg.poll_data;
    const shown = isShownChannel(channelId);
    await inFlight.run(markers.vote(msg.message_id), async () => {
      try {
        const poll: import('../types/api.ts').PollData = JSON.parse(pollData);
        await channelApi.pollVote(channelId, {
          discord_message_id: poll.discord_message_id,
          discord_channel_id: poll.discord_channel_id,
          answer_id: answerId,
        });
        if (!shown()) return;
        addToast(t('community.voteRecorded'), 'success');
      } catch (err) {
        if (!shown()) return;
        addToast(translateCaughtError(err, t('common.error')), 'danger', {
          platformLink: isPlatformError(err),
        });
      }
    });
  };

  const handleCreatePoll = async () => {
    if (!activeChannel || !pollQuestion.trim()) return;
    const validOptions = pollOptions.filter((o) => o.trim());
    if (validOptions.length < 2) return;
    const channelId = activeChannel.channel_id;
    const shown = isShownChannel(channelId);
    setSendingOf(channelId, true);
    try {
      await channelApi.createPoll(channelId, {
        question: pollQuestion.trim(),
        options: validOptions.map((o) => o.trim()),
      });
      // The form belongs to the channel it was filled in (R422.3), and the
      // poll's answer writes nothing in a later visit to it (R483.1).
      if (!shown()) return;
      closePollForm();
      void loadMessages();
    } catch (err) {
      if (!shown()) return;
      addToast(translateCaughtError(err, t('common.error')), 'danger', {
        platformLink: isPlatformError(err),
      });
    } finally {
      setSendingOf(channelId, false);
    }
  };

  const closePollForm = () => {
    setShowPollForm(false);
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  /** Shows channel `ch`. What the page shows for a channel belongs to it:
   *  the poll form, the inline editor and a message's menu close (R422.3). */
  const openChannel = (ch: Channel) => {
    if (ch.channel_id === channelKey) return;
    setActiveChannel(ch);
    closePollForm();
    setEditingMessageId(null);
    setEditText('');
    setMenuOpenId(null);
  };

  // Edit/delete eligibility is computed server-side and returned on each message.
  // Source: crates/api/src/routes/channels.rs MessageResponse::from_message().
  const canEditMessage = (msg: ChannelMessage) => msg.can_edit ?? false;
  const canDeleteMessage = (msg: ChannelMessage) => msg.can_delete ?? false;

  return (
    <>
      <div className="flex h-full flex-1 overflow-hidden">
        {/* Channel sidebar */}
        <div className="w-60 shrink-0 overflow-y-auto border-e border-border bg-surface p-3">
          <h2 className="mbe-1 px-2 text-xs font-semibold tracking-wider text-text-muted uppercase">
            {t('community.channels')}
          </h2>
          <p className="mbe-3 px-2 text-xs text-text-muted">
            {t('community.poweredByDiscord')}
          </p>
          {discordLinked === false && (
            <button
              onClick={() => navigate('/settings?tab=account')}
              className="mbe-3 flex w-full items-center gap-2 rounded-lg bg-[#5865F2] px-3 py-2.5 text-start text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4752C4]"
            >
              <ExternalLink size={14} />
              {t('community.linkDiscord')}
            </button>
          )}
          {discordLinked && discordUsername && (
            <p className="mbe-3 px-2 text-xs text-success">
              {t('community.discordConnected', { username: discordUsername })}
            </p>
          )}
          {isLoadingChannels ? (
            <Spinner size="sm" />
          ) : channelList.length === 0 ? (
            <div className="px-2">
              <p className="text-xs text-text-muted">
                {t('community.noChannelsDesc')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {channelList.map((ch) => (
                <button
                  key={ch.channel_id}
                  onClick={() => openChannel(ch)}
                  className={`rounded-lg border px-3 py-2.5 text-start transition-colors ${
                    activeChannel?.channel_id === ch.channel_id
                      ? 'border-accent/50 bg-accent/10 ring-2 ring-accent/25'
                      : 'border-accent/20 bg-accent/5 hover:border-accent/40 hover:bg-accent/10'
                  }`}
                  aria-current={
                    activeChannel?.channel_id === ch.channel_id
                      ? 'true'
                      : undefined
                  }
                >
                  <span
                    className={`flex items-center gap-2 text-sm font-medium ${
                      activeChannel?.channel_id === ch.channel_id
                        ? 'text-accent'
                        : 'text-text-primary'
                    }`}
                  >
                    {ch.name}
                    {unreadChannels.has(ch.channel_id) &&
                      activeChannel?.channel_id !== ch.channel_id && (
                        <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] leading-none font-bold text-canvas uppercase">
                          {t('community.new')}
                        </span>
                      )}
                  </span>
                  {ch.description && (
                    <span className="mbs-0.5 block text-[11px] leading-snug text-text-secondary">
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
              <EmptyState title={t('community.selectChannel')} description="" />
            </div>
          ) : (
            <>
              {/* Channel header */}
              <div className="flex items-center gap-2 border-be border-border px-4 py-3">
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
                      const sameAuthor = sameMessageAuthor(prev, msg);
                      const withinWindow =
                        sameAuthor &&
                        Math.abs(
                          new Date(msg.created_at).getTime() -
                            new Date(prev!.created_at).getTime(),
                        ) <
                          7 * 60 * 1000;
                      const showHeader = !withinWindow;
                      const displayName = msg.author_removed
                        ? t('community.formerMember')
                        : msg.author_display_name || t('community.unknownUser');
                      const initial = displayName[0]?.toUpperCase() ?? '?';
                      const timeStr = formatTime(msg.created_at);

                      return (
                        <div
                          key={msg.message_id}
                          className={`group/msg relative rounded-lg px-3 hover:bg-surface-raised ${showHeader ? 'mbs-4 pbs-2 pbe-1' : 'py-0.5 ps-12'}`}
                        >
                          {editingMessageId === msg.message_id ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                maxLength={MAX_MESSAGE_LENGTH}
                                aria-label={t('community.editMessageLabel')}
                                disabled={inFlight.isHeld(
                                  markers.editMessage(msg.message_id),
                                )}
                                className="flex-1 rounded-sm border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter')
                                    void handleEdit(msg.message_id);
                                  if (e.key === 'Escape')
                                    setEditingMessageId(null);
                                }}
                                // eslint-disable-next-line jsx-a11y/no-autofocus -- editing inline requires immediate focus
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                disabled={inFlight.isHeld(
                                  markers.editMessage(msg.message_id),
                                )}
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
                                  <div className="mbs-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent">
                                    {initial}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-2">
                                      <span className="text-sm font-medium text-accent">
                                        {displayName}
                                      </span>
                                      {msg.external_author_name != null && (
                                        <span className="text-xs text-text-muted">
                                          {t('community.viaDiscord')}
                                        </span>
                                      )}
                                      <span className="text-xs text-text-muted">
                                        {timeStr}
                                      </span>
                                      {msg.is_edited && (
                                        <span className="text-xs text-text-muted">
                                          {t('common.edited')}
                                        </span>
                                      )}
                                    </div>
                                    {msg.content && (
                                      <p className="text-sm text-text-primary">
                                        {msg.content}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="group/line flex items-start">
                                  <span className="me-3 mbs-0.5 hidden w-8 shrink-0 text-center text-[10px] text-text-muted group-hover/line:inline">
                                    {timeStr}
                                  </span>
                                  {msg.content && (
                                    <p className="text-sm text-text-primary">
                                      {msg.content}
                                    </p>
                                  )}
                                </div>
                              )}
                              {msg.image_url && (
                                <button
                                  onClick={() =>
                                    setExpandedImage(msg.image_url)
                                  }
                                  className="mbs-1 block"
                                >
                                  <img
                                    src={msg.image_url}
                                    alt={t('community.sharedImage')}
                                    className="max-h-48 max-w-xs rounded-lg border border-border object-cover transition-opacity hover:opacity-90"
                                  />
                                </button>
                              )}
                              {msg.poll_data &&
                                (() => {
                                  try {
                                    const poll: import('../types/api.ts').PollData =
                                      JSON.parse(msg.poll_data!);
                                    const totalVotes = poll.options.reduce(
                                      (sum, o) => sum + o.votes,
                                      0,
                                    );
                                    return (
                                      <div className="mbs-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                                        <p className="mbe-2 text-sm font-semibold text-text-primary">
                                          {poll.question}
                                        </p>
                                        <div className="flex flex-col gap-1.5">
                                          {poll.options.map((opt) => (
                                            <button
                                              key={opt.id}
                                              disabled={inFlight.isHeld(
                                                markers.vote(msg.message_id),
                                              )}
                                              onClick={() =>
                                                void handlePollVote(msg, opt.id)
                                              }
                                              className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary transition-colors hover:border-accent hover:bg-accent/10"
                                            >
                                              <span>{opt.text}</span>
                                              <span className="ms-2 text-xs text-text-muted">
                                                {opt.votes}{' '}
                                                {t('community.votes')}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                        <p className="mbs-1.5 text-xs text-text-muted">
                                          {t('community.totalVotes', {
                                            count: totalVotes,
                                          })}
                                        </p>
                                      </div>
                                    );
                                  } catch {
                                    return null;
                                  }
                                })()}

                              {/* Message actions */}
                              <div className="absolute inset-e-2 inset-bs-2 hidden group-hover:flex">
                                <button
                                  onClick={() =>
                                    setMenuOpenId(
                                      menuOpenId === msg.message_id
                                        ? null
                                        : msg.message_id,
                                    )
                                  }
                                  className="rounded-sm p-1 text-text-muted hover:bg-surface hover:text-text-primary"
                                  aria-label={t('common.messageActions')}
                                >
                                  <MoreVertical size={14} />
                                </button>
                                {menuOpenId === msg.message_id && (
                                  <div className="absolute inset-e-0 inset-bs-7 z-10 min-w-35 rounded-lg border border-border bg-surface py-1 shadow-lg">
                                    {canEditMessage(msg) && (
                                      <button
                                        onClick={() => {
                                          setEditingMessageId(msg.message_id);
                                          setEditText(msg.content);
                                          setMenuOpenId(null);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm text-text-secondary hover:bg-surface-raised"
                                      >
                                        <Pencil size={12} /> {t('common.edit')}
                                      </button>
                                    )}
                                    {canDeleteMessage(msg) && (
                                      <button
                                        disabled={inFlight.isHeld(
                                          markers.deleteMessage(msg.message_id),
                                        )}
                                        onClick={() => {
                                          void handleDelete(msg.message_id);
                                          setMenuOpenId(null);
                                        }}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm text-danger hover:bg-surface-raised"
                                      >
                                        <Trash2 size={12} />{' '}
                                        {t('common.delete')}
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
                <div className="border-bs border-border px-4 py-3">
                  <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                    <p className="mbe-2 text-xs font-semibold tracking-wider text-accent uppercase">
                      {t('community.createPoll')}
                    </p>
                    <input
                      type="text"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder={t('community.pollQuestion')}
                      maxLength={300}
                      className="mbe-2 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
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
                        className="mbe-1 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                      />
                    ))}
                    <div className="mbs-2 flex items-center gap-2">
                      {pollOptions.length < 4 && (
                        <button
                          onClick={() => setPollOptions([...pollOptions, ''])}
                          className="flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          <Plus size={12} /> {t('community.addOption')}
                        </button>
                      )}
                      <div className="ms-auto flex gap-2">
                        <Button variant="secondary" onClick={closePollForm}>
                          {t('common.cancel')}
                        </Button>
                        <Button
                          onClick={() => void handleCreatePoll()}
                          disabled={
                            !pollQuestion.trim() ||
                            pollOptions.filter((o) => o.trim()).length < 2 ||
                            isSending
                          }
                        >
                          {t('community.createPollBtn')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Composer */}
              <div className="border-bs border-border px-4 py-3">
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
                      disabled={
                        isSending ||
                        inFlight.isHeld(
                          markers.upload('page', activeChannel.channel_id),
                        )
                      }
                      className="rounded-lg p-2 text-[#5865F2] transition-colors hover:bg-[#5865F2]/10"
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
                      onChange={(e) =>
                        setDraftOf(activeChannel.channel_id, e.target.value)
                      }
                      maxLength={MAX_MESSAGE_LENGTH}
                      placeholder={t('community.messagePlaceholder')}
                      className="flex-1 rounded-lg border-2 border-accent/30 bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none"
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
                      aria-label={t('community.sendMessage')}
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
            className="absolute inset-e-4 inset-bs-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
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

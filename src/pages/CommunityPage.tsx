import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Hash,
  Send,
  MoreVertical,
  Pencil,
  Trash2,
  Flag,
  Lock,
} from 'lucide-react';
import {
  TopBar,
  Button,
  Spinner,
  EmptyState,
  Modal,
  Input,
} from '../components/index.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { channels as channelApi, reports } from '../lib/api/endpoints.ts';
import type { Channel, ChannelMessage } from '../types/api.ts';

const MAX_MESSAGE_LENGTH = 2000;
const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function CommunityPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);

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
  const [reportModal, setReportModal] = useState(false);
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isFreeUser = user?.subscription_tier === 'Free';

  // Load channels
  useEffect(() => {
    const load = async () => {
      setIsLoadingChannels(true);
      try {
        const chs = await channelApi.list();
        setChannelList(chs);
        if (chs.length > 0 && !activeChannel) {
          setActiveChannel(chs[0]!);
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
    } finally {
      setIsLoadingMessages(false);
    }
  }, [activeChannel]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!activeChannel || !messageText.trim() || isSending) return;
    setIsSending(true);
    try {
      const msg = await channelApi.sendMessage(activeChannel.channel_id, {
        body: messageText.trim(),
      });
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
        { body: editText.trim() },
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

  const handleReport = async () => {
    if (!reportTargetId || !reportReason.trim()) return;
    try {
      await reports.create({
        target_type: 'message',
        target_id: reportTargetId,
        reason: reportReason.trim(),
      });
      addToast(t('community.reportSent'), 'success');
      setReportModal(false);
      setReportReason('');
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const canEditMessage = (msg: ChannelMessage) => {
    if (msg.user_id !== user?.user_id) return false;
    const created = new Date(msg.created_at).getTime();
    return Date.now() - created < EDIT_WINDOW_MS;
  };

  const canDeleteMessage = (msg: ChannelMessage) =>
    msg.user_id === user?.user_id;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar
        notificationCount={unreadCount}
        onSearchClick={() => {}}
        onNotificationClick={() => navigate('/notifications')}
        onProfileClick={() => navigate('/settings')}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Channel sidebar */}
        <div className="w-60 shrink-0 overflow-y-auto border-r border-border bg-surface p-3">
          <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t('community.channels')}
          </h2>
          {isLoadingChannels ? (
            <Spinner size="sm" />
          ) : channelList.length === 0 ? (
            <p className="px-2 text-xs text-text-muted">{t('community.noChannels')}</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {channelList.map((ch) => (
                <button
                  key={ch.channel_id}
                  onClick={() => setActiveChannel(ch)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    activeChannel?.channel_id === ch.channel_id
                      ? 'bg-accent-subtle text-accent'
                      : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                  }`}
                  aria-current={activeChannel?.channel_id === ch.channel_id ? 'true' : undefined}
                >
                  <Hash size={14} aria-hidden="true" />
                  <span className="truncate">{ch.name}</span>
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
                <Hash size={16} className="text-text-muted" aria-hidden="true" />
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
                aria-label="Messages"
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-10">
                    <Spinner size="md" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-text-muted">
                    No messages yet. Be the first!
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {messages.map((msg) => (
                      <div
                        key={msg.message_id}
                        className="group relative rounded-lg px-3 py-2 hover:bg-surface-raised"
                      >
                        {editingMessageId === msg.message_id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              maxLength={MAX_MESSAGE_LENGTH}
                              className="flex-1 rounded border border-border-default bg-surface-default px-2 py-1 text-sm text-text-primary"
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
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-medium text-accent">
                                {msg.display_name}
                              </span>
                              <span className="text-xs text-text-muted">
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </span>
                              {msg.edited && (
                                <span className="text-xs text-text-muted">(edited)</span>
                              )}
                            </div>
                            <p className="text-sm text-text-primary">{msg.body}</p>

                            {/* Message actions */}
                            <div className="absolute right-2 top-2 hidden group-hover:flex">
                              <button
                                onClick={() =>
                                  setMenuOpenId(
                                    menuOpenId === msg.message_id ? null : msg.message_id,
                                  )
                                }
                                className="rounded p-1 text-text-muted hover:bg-surface hover:text-text-primary"
                                aria-label="Message actions"
                              >
                                <MoreVertical size={14} />
                              </button>
                              {menuOpenId === msg.message_id && (
                                <div className="absolute right-0 top-7 z-10 min-w-[140px] rounded-lg border border-border bg-surface py-1 shadow-lg">
                                  {canEditMessage(msg) && (
                                    <button
                                      onClick={() => {
                                        setEditingMessageId(msg.message_id);
                                        setEditText(msg.body);
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
                                  <button
                                    onClick={() => {
                                      setReportTargetId(msg.message_id);
                                      setReportModal(true);
                                      setMenuOpenId(null);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-raised"
                                  >
                                    <Flag size={12} /> {t('common.report')}
                                  </button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="border-t border-border px-4 py-3">
                {isFreeUser ? (
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <Lock size={14} aria-hidden="true" />
                    {t('community.readOnly')}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      maxLength={MAX_MESSAGE_LENGTH}
                      placeholder={t('community.messagePlaceholder')}
                      className="flex-1 rounded-lg border border-border-default bg-surface-default px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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

      {/* Report Modal */}
      <Modal
        open={reportModal}
        onClose={() => setReportModal(false)}
        title={t('common.report')}
      >
        <div className="mb-4">
          <Input
            multiline
            label="Reason"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Describe the issue..."
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setReportModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void handleReport()} disabled={!reportReason.trim()}>
            {t('common.report')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

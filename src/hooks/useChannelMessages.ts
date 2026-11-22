import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  translateCaughtError,
  isPlatformError,
} from '../lib/translateError.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { oldestFirstChannelMessages } from '../lib/channelMessages.ts';
import { useCurrentKey, useLatestLoad, whenCurrent } from './useCurrentKey.ts';
import type { ChannelMessage } from '../types/api.ts';

export interface ChannelMessagesOptions {
  /** The channel shown now, or `null` while none is. */
  channelKey: string | null;
  /** How many of the channel's newest messages a load reads. */
  pageSize: number;
  /** Called when a load of channel `key` lands with at least one message,
   *  with the newest one's id: the view marks the channel read. Keep it
   *  stable (`useCallback`), since `loadMessages` depends on it. */
  onLoaded: (key: string, newestMessageId: string) => void;
  /** Whether an action also supersedes the channel's loads when it starts
   *  (R390.3b). The page does; the sidebar does not (R633.2): the read an
   *  action starts when it is answered or fails already supersedes every
   *  read started before it and ends the loading. */
  startOnWrite: boolean;
}

export interface ChannelMessages {
  /** The shown channel's messages, oldest first, or none while another
   *  channel's are held. */
  messages: ChannelMessage[];
  /** True while a channel is shown and no read of it has landed or
   *  failed. */
  isLoadingMessages: boolean;
  /** `useCurrentKey` for the shown channel: an action captures its visit
   *  with it when it starts (R483.1). */
  isShownChannel: (started: string | null) => () => boolean;
  /** Loads the shown channel's newest messages. */
  loadMessages: () => Promise<void>;
  /** Runs an action whose answer changes channel `key`'s messages. */
  writeAnswer: <T>(
    key: string,
    request: () => Promise<T>,
    write: (answer: T) => (prev: ChannelMessage[]) => ChannelMessage[],
  ) => Promise<T>;
}

/**
 * The messages of the channel a community view shows, and the actions that
 * read and write them, for both CommunityPage and CommunitySidebar (R633).
 *
 * The messages the last load or action wrote are held with the channel they
 * are in, and are shown only while that channel is the shown one (R371.1):
 * the first render for another channel shows it loading, never the earlier
 * channel's messages. `loading` is true until a read of the channel has
 * landed or failed: a reload of a channel already read keeps its messages
 * shown.
 *
 * Of the loads of the messages the view starts, only the last one started
 * for the shown channel writes, and only while the view is mounted (R361.1,
 * R381.1). An action whose answer the view writes (a message sent, an image,
 * an edit, a delete) supersedes, when `startOnWrite` is set, every load of
 * its channel started before it when it starts, and every load started while
 * it was pending by the full read of the channel it starts when it ends, so
 * its answer and then that read are the newest writes, and that read ends
 * the loading a read it superseded began (R390.3b, R422.2, R463.2). It does
 * both only while the visit to the channel it began in lasts: answered or
 * failed in a later visit, it writes nothing and reads nothing (R483.1).
 */
export function useChannelMessages({
  channelKey,
  pageSize,
  onLoaded,
  startOnWrite,
}: ChannelMessagesOptions): ChannelMessages {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

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

  // Shows an action's answer in channel `key`'s messages at once, until the
  // read that follows it lands (R422.2): nothing while another channel's are
  // held, or while no read of the channel has landed or failed.
  const showAnswerIn = useCallback(
    (key: string, change: (prev: ChannelMessage[]) => ChannelMessage[]) =>
      setHeld((prev) =>
        prev.key === key && !prev.loading
          ? { ...prev, messages: change(prev.messages) }
          : prev,
      ),
    [],
  );

  const startMessages = useLatestLoad(channelKey);
  const isShownChannel = useCurrentKey(channelKey);

  // A call kept from an earlier channel (a live event, a poll, an action's
  // reload) starts no load (R390.3a).
  const loadMessages = useCallback(async () => {
    if (channelKey === null) return;
    const key = channelKey;
    const isCurrent = startMessages(key);
    if (!isCurrent()) return;
    setHeld((prev) =>
      prev.key === key ? prev : { key, messages: [], loading: true },
    );
    try {
      const msgs = await whenCurrent(
        isCurrent,
        oldestFirstChannelMessages(key, pageSize, isCurrent),
      );
      setHeld({ key, messages: msgs, loading: false });
      // The newest message is last in the list.
      if (msgs.length > 0) {
        onLoaded(key, msgs[msgs.length - 1]!.message_id);
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
  }, [channelKey, pageSize, onLoaded, startMessages, addToast, t]);

  /** The action supersedes every load of the channel started before it when
   *  it starts, where `startOnWrite` is set (R390.3b). The answer is shown at
   *  once, when a read of the channel has landed or failed, and the full
   *  read of the channel it starts then supersedes every load started while
   *  it was pending, so the answer and then that read are the newest writes,
   *  and the read's answer replaces the list (R422.2). An action that fails in
   *  its visit reads the channel again. A read the action superseded never
   *  ends the loading it began; the read the action starts when it ends does
   *  (R463.2). An action keeps the visit it began in: answered or failed in a
   *  later visit to the channel, it shows nothing and reads nothing there
   *  (R483.1). A failure always throws, and the caller decides what to
   *  show. */
  const writeAnswer = useCallback(
    async <T>(
      key: string,
      request: () => Promise<T>,
      write: (answer: T) => (prev: ChannelMessage[]) => ChannelMessage[],
    ): Promise<T> => {
      const shown = isShownChannel(key);
      if (startOnWrite) startMessages(key);
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
    [isShownChannel, startOnWrite, startMessages, showAnswerIn, loadMessages],
  );

  return {
    messages,
    isLoadingMessages,
    isShownChannel,
    loadMessages,
    writeAnswer,
  };
}

import { useCallback, useEffect, useState } from 'react';
import { useEchoWebSocket } from './useEchoWebSocket.ts';
import type { WsEchoEvent } from '../types/api.ts';

/** Returns true if any community channel has unread messages. */
export function useCommunitySidebarUnread(): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  const handleEvent = useCallback((event: WsEchoEvent) => {
    if (event.type === 'CommunityMessagePosted') {
      setHasUnread(true);
    }
  }, []);

  useEchoWebSocket('/ws/community/stream', handleEvent);

  useEffect(() => {
    const handler = () => setHasUnread(false);
    window.addEventListener('community-sidebar-opened', handler);
    return () => window.removeEventListener('community-sidebar-opened', handler);
  }, []);

  return hasUnread;
}

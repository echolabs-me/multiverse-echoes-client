import { createContext, useContext } from 'react';

export type LayoutMode = 'phone' | 'tablet' | 'desktop';

export interface ConversationRequest {
  echoId: string;
  echoName: string;
  echoMood: string;
  resumeConversationId?: string;
}

export interface LayoutContextValue {
  mode: LayoutMode;
  /** Tablet only: request the layout shell to open a conversation overlay. */
  openConversation: (req: ConversationRequest) => void;
  /** Tablet only: close the conversation overlay. */
  closeConversation: () => void;
}

const noop = () => {};

export const LayoutContext = createContext<LayoutContextValue>({
  mode: 'desktop',
  openConversation: noop,
  closeConversation: noop,
});

export function useLayoutMode(): LayoutContextValue {
  return useContext(LayoutContext);
}

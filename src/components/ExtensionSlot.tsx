import { useSyncExternalStore } from 'react';
import {
  getExtensions,
  subscribeExtensions,
  type SlotName,
  type ExtensionProps,
} from '../lib/extensions.ts';

interface ExtensionSlotProps extends ExtensionProps {
  /** Which slot to render extensions for */
  slot: SlotName;
  /** Optional wrapper className applied to the container div */
  className?: string;
}

/**
 * Renders all extension components registered to the given slot.
 * If no extensions are registered, renders nothing.
 */
export function ExtensionSlot({ slot, className, ...props }: ExtensionSlotProps) {
  const extensions = useSyncExternalStore(
    subscribeExtensions,
    () => getExtensions(slot),
    () => getExtensions(slot),
  );

  if (extensions.length === 0) return null;

  return (
    <div className={className} data-extension-slot={slot}>
      {extensions.map((ext) => (
        <ext.component key={ext.id} {...props} />
      ))}
    </div>
  );
}

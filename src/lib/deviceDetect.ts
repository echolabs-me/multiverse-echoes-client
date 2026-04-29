export function isTabletDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(
    '(min-width: 768px) and (max-width: 1439px) and (any-pointer: coarse)',
  ).matches;
}

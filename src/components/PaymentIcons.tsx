/**
 * Inline SVG brand icons for payment providers.
 * Self-contained — no external CDN dependencies.
 * Faithful recreations of official brand identities.
 */

interface IconProps {
  size?: number;
  className?: string;
}

/** Stripe wordmark — faithful recreation of official lowercase "stripe" wordmark. */
export function StripeLogo({ size = 40, className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 60 25"
      width={size}
      height={size * 0.42}
      className={className}
      aria-label="Stripe"
      role="img"
    >
      <path
        fill="currentColor"
        d="M5 10.3c0-.8.7-1.1 1.7-1.1 1.5 0 3.5.5 5 1.3V5.7C10 5.1 8.4 4.8 6.7 4.8 2.7 4.8 0 6.8 0 10.5c0 5.8 8 4.9 8 7.4 0 .9-.8 1.2-1.9 1.2-1.6 0-3.8-.7-5.5-1.6v4.9c1.9.8 3.8 1.2 5.5 1.2 4.1 0 6.9-2 6.9-5.7C13 12 5 13.1 5 10.3zm14.3-5.3l-3.8.8V9h3.8V5zM15.5 10.4h3.8v12.3h-3.8V10.4zM24.4 8l-.2-1.6h-3.5v16.3h3.8v-11c.9-1.2 2.4-1 2.9-.8V7c-.5-.2-2.2-.5-3 1zm7.2-3l-3.7.8v14.6c0 2.7 2 4.7 4.7 4.7 1.5 0 2.6-.3 3.2-.6V21c-.5.2-3.2.9-3.2-1.4v-5.5h3.2V10.4h-3.2V5zm13.2 5.6c0-.5.4-.7.8-.7.7 0 1.5.2 2.2.6l.8-3.2c-.8-.3-1.5-.5-2.8-.5-2.3 0-4.1 1.2-4.1 3.5 0 3.5 4.4 2.9 4.4 4.4 0 .5-.5.7-1.1.7-.9 0-2.2-.4-3.1-.9L42 18c1 .5 2 .7 3.1.7 2.4 0 4-1.1 4-3.5 0-3.8-4.3-3.1-4.3-4.6zm11.3-1.2c-1.2 0-1.9.6-2.4 1l-.2-.8h-3.4v16.3h3.8v-4c.5.3 1.2.5 2 .5 3.4 0 6.5-2.7 6.5-8.7 0-5.5-3-4.3-6.3-4.3zM55 18.5c-.7 0-1.2-.3-1.5-.6V13c.3-.4.8-.6 1.5-.6 1.5 0 2.5 1.3 2.5 3.1 0 1.7-1 3-2.5 3z"
      />
    </svg>
  );
}

/**
 * NOWPayments — green rounded-square with stylised "N" arrow mark,
 * matching the official NOWPayments brand identity.
 * The distinctive element is the "N" with a rightward arrow suggesting payment flow.
 */
export function NowPaymentsLogo({ size = 20, className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-label="NOWPayments"
      role="img"
    >
      <rect rx="6" width="32" height="32" fill="#05C46B" />
      {/* Stylised N with arrow motif — NOWPayments brand mark */}
      <path
        d="M9 22V10h2.5l6 7.5V10H20v12h-2.5l-6-7.5V22H9z"
        fill="#fff"
      />
      {/* Small arrow suggesting crypto payment flow */}
      <path
        d="M22 16l-2-1.5v3z"
        fill="#fff"
        opacity="0.7"
      />
    </svg>
  );
}

/**
 * Xaman (formerly XUMM) — blue rounded-square with the distinctive
 * Xaman geometric X mark. The official Xaman X has angular, slightly
 * rounded strokes forming a modern geometric cross.
 */
export function XamanLogo({ size = 20, className = '' }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-label="Xaman"
      role="img"
    >
      <rect rx="6" width="32" height="32" fill="#3052FF" />
      {/* Xaman geometric X — angular strokes with rounded ends */}
      <path
        d="M10.5 9.5L14.7 16l-4.2 6.5h3.2L16 18.3l2.3 4.2h3.2L17.3 16l4.2-6.5h-3.2L16 13.7l-2.3-4.2h-3.2z"
        fill="#fff"
      />
    </svg>
  );
}

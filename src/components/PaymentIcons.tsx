/**
 * Payment provider brand logos — imported from official brand assets.
 * SVG files in client/src/assets/, rendered as <img> elements.
 */

import stripeLogo from '../assets/stripe-logo.svg';
import nowpaymentsLogo from '../assets/nowpayments-logo.svg';
import xamanLogo from '../assets/xaman-logo.svg';

interface IconProps {
  height?: number;
  className?: string;
}

/** Official Stripe wordmark. */
export function StripeLogo({ height = 20, className = '' }: IconProps) {
  return (
    <img
      src={stripeLogo}
      alt="Stripe"
      height={height}
      className={`w-auto ${className}`}
    />
  );
}

/** Official NOWPayments wordmark with "N" mark. */
export function NowPaymentsLogo({ height = 20, className = '' }: IconProps) {
  return (
    <img
      src={nowpaymentsLogo}
      alt="NOWPayments"
      height={height}
      className={`w-auto ${className}`}
    />
  );
}

/** Official Xaman (formerly XUMM) logo. */
export function XamanLogo({ height = 20, className = '' }: IconProps) {
  return (
    <img
      src={xamanLogo}
      alt="Xaman"
      height={height}
      className={`w-auto ${className}`}
    />
  );
}

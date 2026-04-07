import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, Share2, Image, Check } from 'lucide-react';
import { Button } from './Button.tsx';
import { getComputedTokenColor } from '../lib/tokenColor.ts';

/**
 * Canvas2D font stack mirroring the CSS `body` font-family from
 * `client/src/styles/global.css`. Must stay in sync: canvas2d does not use
 * CSS font-family inheritance, so any locale whose glyphs aren't in Inter
 * or Cyrillic needs the Noto Sans fallbacks explicitly listed here.
 *
 * The browser applies `unicode-range` resolution across named families in
 * Canvas2D the same way it does for DOM text, so Chinese/Hindi/Arabic glyphs
 * in a shared image will render through the matching Noto Sans subset when
 * its woff2 is loaded, and fall through to the system font when not.
 *
 * Reference: docs/claude/i18n-multilingual-tasks.md CC TASK 4 Part C Step 9.
 */
const CANVAS_FONT_STACK =
  "Inter, 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans KR', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Arabic', 'Noto Sans Thai', system-ui, sans-serif";

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  body: string;
  shareUrl: string;
}

export function ShareModal({ open, onClose, title, body, shareUrl }: ShareModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available in all contexts
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: body.slice(0, 200),
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    }
  };

  const handleDownloadImage = () => {
    // Create a simple branded text card as a downloadable image via canvas
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background — reads live CSS token (respects dark/light mode)
    ctx.fillStyle = getComputedTokenColor('--canvas') || '#0f1923';
    ctx.fillRect(0, 0, 800, 420);

    // Border accent
    ctx.fillStyle = getComputedTokenColor('--accent') || '#d4915c';
    ctx.fillRect(0, 0, 800, 4);

    // Title
    ctx.fillStyle = getComputedTokenColor('--text-primary') || '#e8e0d8';
    ctx.font = `bold 24px ${CANVAS_FONT_STACK}`;
    ctx.fillText(title.slice(0, 60), 40, 60);

    // Body (wrap text)
    ctx.fillStyle = getComputedTokenColor('--text-secondary') || '#9ba8b4';
    ctx.font = `16px ${CANVAS_FONT_STACK}`;
    const words = body.split(' ');
    let line = '';
    let y = 100;
    for (const word of words) {
      const testLine = line + word + ' ';
      if (ctx.measureText(testLine).width > 720 || y > 320) {
        ctx.fillText(line, 40, y);
        line = word + ' ';
        y += 24;
        if (y > 340) {
          ctx.fillText('...', 40, y);
          break;
        }
      } else {
        line = testLine;
      }
    }
    if (y <= 340) {
      ctx.fillText(line, 40, y);
    }

    // Footer disclaimer
    ctx.fillStyle = getComputedTokenColor('--text-muted') || '#5e6f7e';
    ctx.font = `12px ${CANVAS_FONT_STACK}`;
    ctx.fillText(t('share.imageDisclaimer'), 40, 390);

    // Brand
    ctx.fillStyle = getComputedTokenColor('--accent') || '#d4915c';
    ctx.font = `bold 14px ${CANVAS_FONT_STACK}`;
    ctx.fillText('Multiverse Echoes', 600, 390);

    // Download
    const link = document.createElement('a');
    link.download = 'multiverse-echoes-share.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-full max-w-sm rounded-lg border border-border bg-canvas p-0 text-text-primary shadow-lg backdrop:bg-black/50"
      aria-label={t('share.title')}
    >
      <div className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{t('share.title')}</h2>

        {/* Preview card */}
        <div className="mb-4 rounded-lg border border-border bg-surface p-4">
          <p className="text-sm font-medium text-text-primary line-clamp-2">{title}</p>
          <p className="mt-1 text-xs text-text-secondary line-clamp-3">{body}</p>
          <p className="mt-2 text-[10px] text-text-secondary">{t('share.previewDisclaimer')}</p>
        </div>

        {/* Share actions */}
        <div className="space-y-2">
          <button
            onClick={() => void handleCopyLink()}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-start text-sm transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {copied ? (
              <Check size={18} className="text-success" />
            ) : (
              <Link2 size={18} className="text-text-secondary" />
            )}
            <span>{copied ? t('common.copied') : t('share.copyLink')}</span>
          </button>

          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              onClick={() => void handleNativeShare()}
              className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-start text-sm transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <Share2 size={18} className="text-text-secondary" />
              <span>{t('share.shareToSocial')}</span>
            </button>
          )}

          <button
            onClick={handleDownloadImage}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-start text-sm transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <Image size={18} className="text-text-secondary" />
            <span>{t('share.downloadImage')}</span>
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  FileText,
  FileJson,
  Film,
  FileType,
  CheckCircle,
  Loader,
  Lock,
} from 'lucide-react';
import { Button } from './Button.tsx';
import { account } from '../lib/api/endpoints.ts';
import type { ExportFormat, DataExport } from '../types/api.ts';

interface StoryExportModalProps {
  open: boolean;
  onClose: () => void;
  echoName: string;
  echoId: string;
}

const FORMAT_OPTIONS: Array<{
  format: ExportFormat;
  icon: React.ReactNode;
  labelKey: string;
  descKey: string;
}> = [
  {
    format: 'text',
    icon: <FileText size={20} />,
    labelKey: 'export.formatText',
    descKey: 'export.formatTextDesc',
  },
  {
    format: 'json',
    icon: <FileJson size={20} />,
    labelKey: 'export.formatJson',
    descKey: 'export.formatJsonDesc',
  },
  {
    format: 'pdf',
    icon: <FileType size={20} />,
    labelKey: 'export.formatPdf',
    descKey: 'export.formatPdfDesc',
  },
  {
    format: 'video',
    icon: <Film size={20} />,
    labelKey: 'export.formatVideo',
    descKey: 'export.formatVideoDesc',
  },
];

export function StoryExportModal({
  open,
  onClose,
  echoName,
  echoId,
}: StoryExportModalProps) {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('text');
  const [exportData, setExportData] = useState<DataExport | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tierGated, setTierGated] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Open/close dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleExport = async () => {
    setIsRequesting(true);
    setError(null);
    setTierGated(false);
    try {
      const result = await account.requestExport({
        echo_id: echoId,
        format: selectedFormat,
      });
      setExportData(result);

      // Poll for status updates
      if (
        result.status !== 'Complete' &&
        result.status !== 'Failed'
      ) {
        pollRef.current = setInterval(async () => {
          try {
            const updated = await account.getExportStatus(
              result.export_id,
            );
            setExportData(updated);
            if (
              updated.status === 'Complete' ||
              updated.status === 'Failed'
            ) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } catch {
            // Silently retry on next interval
          }
        }, 3000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('TIER_REQUIRED')) {
        setTierGated(true);
      } else {
        setError('export.errorRequesting');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleClose = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setExportData(null);
    setError(null);
    setTierGated(false);
    onClose();
  };

  // Compute progress percentage for the bar.
  const progressPercent =
    exportData?.status === 'Processing'
      ? 60
      : exportData?.status === 'Complete'
        ? 100
        : exportData?.status === 'Failed'
          ? 100
          : 25; // Pending starts at 25% to show progress immediately

  const downloadUrl =
    exportData?.download_url ?? exportData?.download_path ?? null;
  const subtitleUrl = exportData?.subtitle_path ?? null;

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="w-full max-w-md rounded-lg border border-border bg-canvas p-0 text-text-primary shadow-lg backdrop:bg-black/50"
      aria-label={t('export.title')}
    >
      <div className="p-6">
        <h2 className="mb-1 text-lg font-semibold">{t('export.title')}</h2>
        <p className="mb-4 text-sm text-text-secondary">
          {t('export.subtitle', { name: echoName })}
        </p>

        {/* AI Disclaimer */}
        <div className="mb-4 rounded-md bg-surface p-3 text-xs text-text-secondary">
          {t('export.disclaimer')}
        </div>

        {!exportData && !tierGated ? (
          <>
            {/* Format selection */}
            <fieldset className="mb-4 space-y-2">
              <legend className="mb-2 text-sm font-medium text-text-secondary">
                {t('export.selectFormat')}
              </legend>
              {FORMAT_OPTIONS.map((opt) => (
                <label
                  key={opt.format}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selectedFormat === opt.format
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:bg-surface'
                  }`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={opt.format}
                    checked={selectedFormat === opt.format}
                    onChange={() => setSelectedFormat(opt.format)}
                    className="sr-only"
                  />
                  <span className="text-text-secondary">{opt.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t(opt.labelKey)}</p>
                    <p className="text-xs text-text-secondary">{t(opt.descKey)}</p>
                  </div>
                  {opt.format === 'video' && (
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      Core+
                    </span>
                  )}
                </label>
              ))}
            </fieldset>

            {error && <p className="mb-4 text-sm text-danger">{t(error)}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => void handleExport()}
                disabled={isRequesting}
              >
                <Download size={16} />
                {isRequesting ? t('common.loading') : t('export.request')}
              </Button>
            </div>
          </>
        ) : tierGated ? (
          /* Tier gate CTA */
          <div className="flex flex-col items-center gap-4 py-4">
            <Lock size={32} className="text-text-muted" />
            <p className="text-center text-sm text-text-secondary">
              {t('export.tierRequired')}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleClose}>{t('export.upgradeCta')}</Button>
            </div>
          </div>
        ) : (
          <>
            {/* Export progress + status */}
            <div className="mb-4">
              {/* Progress bar */}
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    exportData?.status === 'Failed'
                      ? 'bg-danger'
                      : exportData?.status === 'Complete'
                        ? 'bg-success'
                        : 'bg-accent'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                  role="progressbar"
                  aria-valuenow={progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={t('export.progress')}
                />
              </div>

              <div className="flex items-center gap-3">
                {exportData?.status === 'Processing' && (
                  <Loader
                    size={16}
                    className="animate-spin text-accent"
                  />
                )}
                {exportData?.status === 'Complete' && (
                  <CheckCircle size={16} className="text-success" />
                )}
                <p className="text-sm font-medium">
                  {t(`export.status${exportData?.status ?? 'Processing'}`)}
                </p>
              </div>
              <p className="mt-1 text-xs text-text-secondary">
                {t('export.formatLabel')}: {exportData?.format}
              </p>
            </div>

            {exportData?.status === 'Complete' && downloadUrl && (
              <div className="mb-4 flex flex-col gap-2">
                <a
                  href={downloadUrl}
                  download
                  className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-accent-hover"
                >
                  <Download size={16} />
                  {t('export.download')}
                </a>
                {subtitleUrl && (
                  <a
                    href={subtitleUrl}
                    download
                    className="flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface"
                  >
                    <FileText size={14} />
                    {t('export.downloadSubtitles')}
                  </a>
                )}
                <p className="text-center text-xs text-text-secondary">{t('export.downloadHint')}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" onClick={handleClose}>
                {t('common.close')}
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

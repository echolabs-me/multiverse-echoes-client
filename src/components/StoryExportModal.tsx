import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText, FileJson, FileWarning, CheckCircle, Loader } from 'lucide-react';
import { Button } from './Button.tsx';
import { account } from '../lib/api/endpoints.ts';
import type { ExportFormat, ExportStatus, DataExport } from '../types/api.ts';

interface StoryExportModalProps {
  open: boolean;
  onClose: () => void;
  echoName: string;
}

const FORMAT_OPTIONS: Array<{
  format: ExportFormat;
  icon: React.ReactNode;
  labelKey: string;
  descKey: string;
  disabled: boolean;
}> = [
  {
    format: 'text',
    icon: <FileText size={20} />,
    labelKey: 'export.formatText',
    descKey: 'export.formatTextDesc',
    disabled: false,
  },
  {
    format: 'json',
    icon: <FileJson size={20} />,
    labelKey: 'export.formatJson',
    descKey: 'export.formatJsonDesc',
    disabled: false,
  },
  {
    format: 'pdf',
    icon: <FileWarning size={20} />,
    labelKey: 'export.formatPdf',
    descKey: 'export.formatPdfDesc',
    disabled: true,
  },
];

const STATUS_ICONS: Record<ExportStatus, React.ReactNode> = {
  Pending: <Loader size={16} className="animate-spin text-text-muted" />,
  Processing: <Loader size={16} className="animate-spin text-accent" />,
  Ready: <CheckCircle size={16} className="text-success" />,
  Failed: <FileWarning size={16} className="text-danger" />,
};

export function StoryExportModal({ open, onClose, echoName }: StoryExportModalProps) {
  const { t } = useTranslation();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('text');
  const [exportData, setExportData] = useState<DataExport | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    try {
      const result = await account.requestExport({ format: selectedFormat });
      setExportData(result);

      // Poll for status updates
      if (result.status !== 'Ready' && result.status !== 'Failed') {
        pollRef.current = setInterval(async () => {
          try {
            const updated = await account.getExportStatus(result.export_id);
            setExportData(updated);
            if (updated.status === 'Ready' || updated.status === 'Failed') {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
            }
          } catch {
            // Silently retry on next interval
          }
        }, 3000);
      }
    } catch {
      setError('export.errorRequesting');
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
    onClose();
  };

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
        <div className="mb-4 rounded-md bg-surface p-3 text-xs text-text-muted">
          {t('export.disclaimer')}
        </div>

        {!exportData ? (
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
                    opt.disabled
                      ? 'cursor-not-allowed border-border opacity-50'
                      : selectedFormat === opt.format
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
                    disabled={opt.disabled}
                    className="sr-only"
                  />
                  <span className="text-text-secondary">{opt.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{t(opt.labelKey)}</p>
                    <p className="text-xs text-text-muted">{t(opt.descKey)}</p>
                  </div>
                </label>
              ))}
            </fieldset>

            {error && <p className="mb-4 text-sm text-danger">{t(error)}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => void handleExport()} disabled={isRequesting}>
                <Download size={16} />
                {isRequesting ? t('common.loading') : t('export.request')}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Export status */}
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-border p-4">
              {STATUS_ICONS[exportData.status]}
              <div>
                <p className="text-sm font-medium">
                  {t(`export.status${exportData.status}`)}
                </p>
                <p className="text-xs text-text-muted">
                  {new Date(exportData.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {exportData.status === 'Ready' && exportData.download_url && (
              <a
                href={exportData.download_url}
                download
                className="mb-4 flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-accent-hover"
              >
                <Download size={16} />
                {t('export.download')}
              </a>
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

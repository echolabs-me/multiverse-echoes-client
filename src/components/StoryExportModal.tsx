import { useState, useEffect, useRef, useCallback } from 'react';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from './Button.tsx';
import { account, echoes as echoesApi } from '../lib/api/endpoints.ts';
import { getBaseUrl, getAccessToken } from '../lib/api/client.ts';
import type { ExportFormat, DataExport } from '../types/api.ts';

interface StoryExportModalProps {
  open: boolean;
  onClose: () => void;
  echoName: string;
  echoId: string;
}

interface EchoOption {
  echo_id: string;
  name: string;
  shard_name: string;
}

const FORMAT_OPTIONS: Array<{
  format: ExportFormat;
  icon: React.ReactNode;
  labelKey: string;
  descKey: string;
  disabled?: boolean;
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
    disabled: true,
  },
];

/** Map server status to i18n key suffix. */
function statusKey(status: string | undefined): string {
  switch (status) {
    case 'Complete':
      return 'statusComplete';
    case 'Failed':
      return 'statusFailed';
    case 'Processing':
      return 'statusProcessing';
    default:
      return 'statusPending';
  }
}

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
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Echo selection state
  const [allEchoes, setAllEchoes] = useState<EchoOption[]>([]);
  const [selectedEchoIds, setSelectedEchoIds] = useState<Set<string>>(new Set([echoId]));
  const [echoesLoading, setEchoesLoading] = useState(false);

  // Download state
  const [isDownloading, setIsDownloading] = useState(false);

  // Date range state
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Fetch all user echoes when dialog opens
  const fetchEchoes = useCallback(async () => {
    setEchoesLoading(true);
    try {
      const list = await echoesApi.list();
      // Resolve shard names in parallel
      const shardCache = new Map<string, string>();
      const uniqueShardIds = [...new Set(list.map((e) => e.current_shard_id))];
      await Promise.all(
        uniqueShardIds.map(async (sid) => {
          try {
            const shard = await import('../lib/api/endpoints.ts').then((m) => m.shards.get(sid));
            const slug = shard.name.toLowerCase().replace(/\s+/g, '-');
            shardCache.set(sid, t(`shardNames.${slug}`, { defaultValue: shard.name }));
          } catch {
            // ignore
          }
        }),
      );
      setAllEchoes(
        list.map((e) => ({
          echo_id: e.echo_id,
          name: e.name,
          shard_name: shardCache.get(e.current_shard_id) ?? '',
        })),
      );
    } catch {
      // Fallback: just show the current echo
      setAllEchoes([{ echo_id: echoId, name: echoName, shard_name: '' }]);
    } finally {
      setEchoesLoading(false);
    }
  }, [echoId, echoName, t]);

  // Open/close dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setSelectedEchoIds(new Set([echoId]));
      void fetchEchoes();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, echoId, fetchEchoes]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const toggleEcho = (id: string) => {
    setSelectedEchoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedEchoIds(new Set(allEchoes.map((e) => e.echo_id)));
  };

  const handleExport = async () => {
    if (selectedEchoIds.size === 0) return;
    setIsRequesting(true);
    setError(null);
    setTierGated(false);
    try {
      const result = await account.requestExport({
        echo_ids: Array.from(selectedEchoIds),
        format: selectedFormat,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setExportData(result);

      // Poll for status updates
      if (
        result.status !== 'Complete' &&
        result.status !== 'Failed'
      ) {
        const pollStatus = async () => {
          try {
            const updated = await account.getExportStatus(result.export_id);
            setExportData(updated);
            if (updated.status === 'Complete' || updated.status === 'Failed') {
              pollRef.current = null;
              return; // Stop polling
            }
          } catch {
            // Silently retry on next interval
          }
          pollRef.current = setTimeout(() => void pollStatus(), 3000);
        };
        pollRef.current = setTimeout(() => void pollStatus(), 3000);
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

  const handleDownload = () => {
    if (!exportData || isDownloading) return;
    setIsDownloading(true);
    const path = account.downloadExport(exportData.export_id);
    const url = `${getBaseUrl()}${path}`;
    const token = getAccessToken();

    // Fetch with auth header, create blob, trigger download
    void fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const disposition = res.headers.get('Content-Disposition');
        const match = disposition?.match(/filename="?([^"]+)"?/);
        const fallbackName = selectedEchoIds.size > 1
          ? 'echoes-story'
          : `${allEchoes.find((e) => selectedEchoIds.has(e.echo_id))?.name ?? echoName}-story`;
        const ext = selectedFormat === 'json' ? 'json' : selectedFormat === 'pdf' ? 'pdf' : 'txt';
        const filename = match?.[1] ?? `${fallbackName}.${ext}`;
        return res.blob().then((blob) => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        setError('export.errorRequesting');
      })
      .finally(() => {
        setIsDownloading(false);
      });
  };

  const handleClose = () => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setExportData(null);
    setError(null);
    setTierGated(false);
    setIsDownloading(false);
    setDateRangeOpen(false);
    setFromDate('');
    setToDate('');
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
          : 25;

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="w-full max-w-md rounded-lg border border-border bg-canvas p-0 text-text-primary shadow-lg backdrop:bg-black/50"
      aria-label={t('export.title')}
    >
      <div className="p-6">
        <h2 className="mbe-1 text-lg font-semibold">{t('export.title')}</h2>
        <p className="mbe-4 text-sm text-text-secondary">
          {selectedEchoIds.size > 1
            ? t('export.subtitleMultiple')
            : t('export.subtitle', {
                name: allEchoes.find((e) => selectedEchoIds.has(e.echo_id))?.name ?? echoName,
              })}
        </p>

        {/* AI Disclaimer */}
        <div className="mbe-4 rounded-md bg-surface p-3 text-xs text-text-secondary">
          {t('export.disclaimer')}
        </div>

        {!exportData && !tierGated ? (
          <>
            {/* Step 1: Echo selection */}
            <fieldset className="mbe-4">
              <legend className="mbe-2 text-sm font-medium text-text-secondary">
                {t('export.selectEchoes')}
              </legend>
              {echoesLoading ? (
                <div className="flex items-center gap-2 py-2 text-xs text-text-secondary">
                  <Loader size={14} className="animate-spin" />
                  {t('common.loading')}
                </div>
              ) : (
                <>
                  <div className="mbe-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                    {allEchoes.map((echo) => (
                      <label
                        key={echo.echo_id}
                        className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors hover:bg-surface"
                      >
                        <input
                          type="checkbox"
                          checked={selectedEchoIds.has(echo.echo_id)}
                          onChange={() => toggleEcho(echo.echo_id)}
                          className="rounded-sm border-border"
                        />
                        <span className="flex-1 truncate">{echo.name}</span>
                        {echo.shard_name && (
                          <span className="text-xs text-text-secondary">
                            {echo.shard_name}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs font-medium text-accent hover:text-accent-hover"
                  >
                    {t('export.selectAll')}
                  </button>
                </>
              )}
            </fieldset>

            {/* Step 2: Date range (collapsible) */}
            <div className="mbe-4">
              <button
                type="button"
                onClick={() => setDateRangeOpen((p) => !p)}
                className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                {dateRangeOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {t('export.dateRange')}
              </button>
              {dateRangeOpen && (
                <div className="mbs-2 flex items-center gap-3 rounded-lg border border-border p-3">
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-xs text-text-secondary" htmlFor="export-from">
                      {t('export.dateFrom')}
                    </label>
                    <input
                      id="export-from"
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="rounded-sm border border-border bg-canvas px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-xs text-text-secondary" htmlFor="export-to">
                      {t('export.dateTo')}
                    </label>
                    <input
                      id="export-to"
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="rounded-sm border border-border bg-canvas px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Format selection */}
            <fieldset className="mbe-4 space-y-2">
              <legend className="mbe-2 text-sm font-medium text-text-secondary">
                {t('export.selectFormat')}
              </legend>
              {FORMAT_OPTIONS.map((opt) => (
                <label
                  key={opt.format}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    opt.disabled
                      ? 'cursor-not-allowed border-border opacity-50'
                      : selectedFormat === opt.format
                        ? 'cursor-pointer border-accent bg-accent/5'
                        : 'cursor-pointer border-border hover:bg-surface'
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
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t(opt.labelKey)}</p>
                    <p className="text-xs text-text-secondary">{t(opt.descKey)}</p>
                  </div>
                  {opt.disabled && (
                    <span className="rounded-sm bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                      {t('export.comingPostLaunch')}
                    </span>
                  )}
                </label>
              ))}
            </fieldset>

            {error && <p className="mbe-4 text-sm text-danger">{t(error)}</p>}

            {/* Step 4: Export button */}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => void handleExport()}
                disabled={isRequesting || selectedEchoIds.size === 0}
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
            <div className="mbe-4">
              {/* Progress bar */}
              <div className="mbe-3 h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    exportData?.status === 'Failed'
                      ? 'bg-danger'
                      : exportData?.status === 'Complete'
                        ? 'bg-success'
                        : 'bg-accent'
                  } me-progress-bar`}
                  ref={(el) => {
                    if (el) el.style.setProperty('--me-progress', `${progressPercent}%`);
                  }}
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
                  {t(`export.${statusKey(exportData?.status)}`)}
                </p>
              </div>
              <p className="mbs-1 text-xs text-text-secondary">
                {t('export.formatLabel')}: {exportData?.format}
              </p>
            </div>

            {exportData?.status === 'Complete' && (
              <div className="mbe-4 flex flex-col gap-2">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-accent-hover disabled:opacity-70"
                >
                  {isDownloading ? (
                    <Loader size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {isDownloading ? t('export.downloading') : t('export.download')}
                </button>
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

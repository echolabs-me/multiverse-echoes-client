import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { StoryExportModal } from '../src/components/StoryExportModal.tsx';

// Mock the API.
const mockRequestExport = vi.fn();
const mockGetExportStatus = vi.fn();
const mockListEchoes = vi.fn();
const mockGetShard = vi.fn();

vi.mock('../src/lib/api/endpoints.ts', () => ({
  account: {
    requestExport: (...args: unknown[]) => mockRequestExport(...args),
    getExportStatus: (...args: unknown[]) => mockGetExportStatus(...args),
  },
  echoes: {
    list: (...args: unknown[]) => mockListEchoes(...args),
  },
  shards: {
    get: (...args: unknown[]) => mockGetShard(...args),
  },
}));

const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.cancel': 'Cancel',
        'common.close': 'Close',
        'common.loading': 'Loading...',
        'export.title': 'Export Echo Story',
        'export.subtitle': "Export {{name}}'s story",
        'export.disclaimer': 'AI-generated content disclaimer.',
        'export.selectEchoes': 'Select Echoes to export',
        'export.selectAll': 'Select All',
        'export.dateRange': 'Filter by date range (optional)',
        'export.dateFrom': 'From',
        'export.dateTo': 'To',
        'export.selectFormat': 'Choose format',
        'export.formatText': 'Plain Text',
        'export.formatTextDesc': 'Human-readable',
        'export.formatJson': 'JSON',
        'export.formatJsonDesc': 'Structured data',
        'export.formatPdf': 'PDF',
        'export.formatPdfDesc': 'Formatted document',
        'export.formatVideo': 'Video (MP4)',
        'export.formatVideoDesc': 'Timeline video with captions',
        'export.request': 'Export',
        'export.errorRequesting': 'Could not start export.',
        'export.tierRequired': 'Video requires Core tier.',
        'export.upgradeCta': 'View plans',
        'export.statusProcessing': 'Generating export...',
        'export.statusReady': 'Export ready!',
        'export.statusFailed': 'Export failed.',
        'export.comingPostLaunch': 'Coming post-launch',
        'export.download': 'Download',
        'export.downloadSubtitles': 'Download subtitles (.srt)',
        'export.progress': 'Export progress',
        'export.formatLabel': 'Format',
        'export.downloadHint': 'File will be saved to your Downloads folder.',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>;
}

// happy-dom doesn't support <dialog>.showModal(), so we mock it.
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
  mockRequestExport.mockReset();
  mockGetExportStatus.mockReset();
  mockListEchoes.mockReset();
  mockGetShard.mockReset();
  // Default: return the current echo
  mockListEchoes.mockResolvedValue([
    { echo_id: 'echo-123', name: 'Sakura', current_shard_id: 'shard-1' },
  ]);
  mockGetShard.mockResolvedValue({ name: 'Cyber-Tokyo 2045' });
});

describe('StoryExportModal', () => {
  it('renders all format options including video and PDF', async () => {
    await act(async () => {
      render(
        <Wrapper>
          <StoryExportModal
            open={true}
            onClose={() => {}}
            echoName="Sakura"
            echoId="echo-123"
          />
        </Wrapper>,
      );
    });
    expect(screen.getByText('Plain Text')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Video (MP4)')).toBeInTheDocument();
  });

  it('shows coming post-launch badge on video format', async () => {
    await act(async () => {
      render(
        <Wrapper>
          <StoryExportModal
            open={true}
            onClose={() => {}}
            echoName="Test"
            echoId="echo-123"
          />
        </Wrapper>,
      );
    });
    expect(screen.getByText('Coming post-launch')).toBeInTheDocument();
  });

  it('shows progress bar during export', async () => {
    mockRequestExport.mockResolvedValue({
      export_id: 'exp-1',
      status: 'Processing',
      format: 'text',
      created_at: new Date().toISOString(),
    });

    await act(async () => {
      render(
        <Wrapper>
          <StoryExportModal
            open={true}
            onClose={() => {}}
            echoName="Test"
            echoId="echo-123"
          />
        </Wrapper>,
      );
    });

    const exportBtn = screen.getByRole('button', { name: /Export/, hidden: true });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(screen.getByText('Generating export...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument();
  });

  it('sends echo_ids array in export request', async () => {
    mockRequestExport.mockResolvedValue({
      export_id: 'exp-1',
      status: 'Processing',
      format: 'text',
      created_at: new Date().toISOString(),
    });

    await act(async () => {
      render(
        <Wrapper>
          <StoryExportModal
            open={true}
            onClose={() => {}}
            echoName="Test"
            echoId="echo-123"
          />
        </Wrapper>,
      );
    });

    const exportBtn = screen.getByRole('button', { name: /Export/, hidden: true });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(mockRequestExport).toHaveBeenCalledWith(
      expect.objectContaining({
        echo_ids: ['echo-123'],
        format: 'text',
      }),
    );
  });

  it('shows tier gate for video on free tier', async () => {
    mockRequestExport.mockRejectedValue(new Error('TIER_REQUIRED'));

    await act(async () => {
      render(
        <Wrapper>
          <StoryExportModal
            open={true}
            onClose={() => {}}
            echoName="Test"
            echoId="echo-123"
          />
        </Wrapper>,
      );
    });

    // Select video format (disabled but click the label).
    const videoLabel = screen.getByText('Video (MP4)').closest('label');
    fireEvent.click(videoLabel!);

    const exportBtn = screen.getByRole('button', { name: /Export/, hidden: true });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(screen.getByText('Video requires Core tier.')).toBeInTheDocument();
    expect(screen.getByText('View plans')).toBeInTheDocument();
  });

  it('shows AI disclaimer', async () => {
    await act(async () => {
      render(
        <Wrapper>
          <StoryExportModal
            open={true}
            onClose={() => {}}
            echoName="Test"
            echoId="echo-123"
          />
        </Wrapper>,
      );
    });
    expect(
      screen.getByText('AI-generated content disclaimer.'),
    ).toBeInTheDocument();
  });

  it('renders echo checkboxes from API', async () => {
    mockListEchoes.mockResolvedValue([
      { echo_id: 'echo-1', name: 'Echo Alpha', current_shard_id: 'shard-1' },
      { echo_id: 'echo-2', name: 'Echo Beta', current_shard_id: 'shard-2' },
    ]);
    mockGetShard
      .mockResolvedValueOnce({ name: 'Shard One' })
      .mockResolvedValueOnce({ name: 'Shard Two' });

    await act(async () => {
      render(
        <Wrapper>
          <StoryExportModal
            open={true}
            onClose={() => {}}
            echoName="Echo Alpha"
            echoId="echo-1"
          />
        </Wrapper>,
      );
    });

    // Wait for async echo fetch to complete
    expect(await screen.findByText('Echo Alpha')).toBeInTheDocument();
    expect(screen.getByText('Echo Beta')).toBeInTheDocument();
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });
});

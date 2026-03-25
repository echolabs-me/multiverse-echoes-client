import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { StoryExportModal } from '../src/components/StoryExportModal.tsx';

// Mock the API.
const mockRequestExport = vi.fn();
const mockGetExportStatus = vi.fn();

vi.mock('../src/lib/api/endpoints.ts', () => ({
  account: {
    requestExport: (...args: unknown[]) => mockRequestExport(...args),
    getExportStatus: (...args: unknown[]) => mockGetExportStatus(...args),
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
        'export.download': 'Download',
        'export.downloadSubtitles': 'Download subtitles (.srt)',
        'export.progress': 'Export progress',
        'export.formatLabel': 'Format',
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
});

describe('StoryExportModal', () => {
  it('renders all format options including video and PDF', () => {
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
    expect(screen.getByText('Plain Text')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Video (MP4)')).toBeInTheDocument();
  });

  it('shows Core+ badge on video format', () => {
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
    expect(screen.getByText('Core+')).toBeInTheDocument();
  });

  it('can select video format', () => {
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
    const videoLabel = screen.getByText('Video (MP4)').closest('label');
    expect(videoLabel).toBeTruthy();
    fireEvent.click(videoLabel!);
    // The radio should be checked.
    const radio = videoLabel!.querySelector('input[type="radio"]') as HTMLInputElement;
    expect(radio.value).toBe('video');
  });

  it('shows progress bar during export', async () => {
    mockRequestExport.mockResolvedValue({
      export_id: 'exp-1',
      status: 'Processing',
      format: 'video',
      created_at: new Date().toISOString(),
    });

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

    const exportBtn = screen.getByRole('button', { name: /Export/, hidden: true });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(screen.getByText('Generating export...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { hidden: true })).toBeInTheDocument();
  });

  it('shows tier gate for video on free tier', async () => {
    mockRequestExport.mockRejectedValue(new Error('TIER_REQUIRED'));

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

    // Select video format.
    const videoLabel = screen.getByText('Video (MP4)').closest('label');
    fireEvent.click(videoLabel!);

    const exportBtn = screen.getByRole('button', { name: /Export/, hidden: true });
    await act(async () => {
      fireEvent.click(exportBtn);
    });

    expect(screen.getByText('Video requires Core tier.')).toBeInTheDocument();
    expect(screen.getByText('View plans')).toBeInTheDocument();
  });

  it('shows AI disclaimer', () => {
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
    expect(
      screen.getByText('AI-generated content disclaimer.'),
    ).toBeInTheDocument();
  });
});

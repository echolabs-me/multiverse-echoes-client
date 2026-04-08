/**
 * Voice pipeline audio bridge — handles audio I/O for the turn-based voice pipeline.
 *
 * Protocol (JSON text frames — avoids Cloudflare binary frame fragmentation):
 *   Client → Sidecar:
 *     Binary: \x01 + Ogg Opus bytes = user audio (mic recording)
 *     Binary: \x05                   = end-of-utterance signal
 *
 *   Sidecar → Client (JSON text frames):
 *     {"type":"audio","data":"<base64 int16 LE PCM>"} = TTS audio (24kHz mono)
 *     {"type":"text","data":"<string>"}                = conversation transcript
 *     {"type":"video","data":"<base64 JPEG>"}          = lip-synced video frame
 *     {"type":"state","state":"<listening|thinking|speaking>"} = state change
 */

const SAMPLE_RATE = 24000;

export type VoicePipelineState = 'listening' | 'thinking' | 'speaking';

export interface VoiceAudioCallbacks {
  onConnected: () => void;
  onStateChange: (state: VoicePipelineState) => void;
  onText: (text: string) => void;
  onAudioActivity: () => void;
  onVideoFrame: (jpegBlob: Blob) => void;
  onError: (error: string) => void;
  onClose: () => void;
  onDebug?: (info: string) => void;
}

/** Build a WAV blob from int16 PCM bytes at the given sample rate. */
function buildWavBlob(pcmBytes: Uint8Array, sampleRate: number): Blob {
  const dataSize = pcmBytes.length;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataSize, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt chunk
  view.setUint32(12, 0x666D7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);
  const headerBytes = new Uint8Array(header);
  const wavData = new Uint8Array(44 + dataSize);
  wavData.set(headerBytes, 0);
  wavData.set(pcmBytes, 44);
  return new Blob([wavData.buffer as ArrayBuffer], { type: 'audio/wav' });
}

export class VoiceAudioBridge {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private recorder: unknown = null;
  private gainNode: GainNode | null = null;

  // Accumulate raw PCM bytes during speaking, play as single WAV when done
  private pcmChunks: Uint8Array[] = [];
  private totalPcmBytes = 0;
  private chunksReceived = 0;
  private audioElement: HTMLAudioElement | null = null;
  private blobUrl: string | null = null;

  private callbacks: VoiceAudioCallbacks;
  private isMuted = false;

  constructor(callbacks: VoiceAudioCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(wsUrl: string, preCreatedAudioCtx?: AudioContext, preCreatedMicStream?: MediaStream): Promise<void> {
    // AudioContext only needed for mic capture (opus-recorder uses it)
    if (preCreatedAudioCtx) {
      this.audioCtx = preCreatedAudioCtx;
    } else {
      try {
        this.audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
      } catch {
        this.audioCtx = new AudioContext();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
    }
    // GainNode not used for playback anymore but keep for mic level if needed
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);

    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 30000);

      this.ws!.onopen = () => {
        clearTimeout(timeout);
        this.callbacks.onConnected();
        resolve();
      };

      this.ws!.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as {
              type: string;
              data?: string;
              state?: string;
            };

            if (msg.type === 'audio' && msg.data) {
              // Decode base64 → raw int16 PCM bytes, accumulate
              const raw = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
              this.pcmChunks.push(raw);
              this.totalPcmBytes += raw.length;
              this.chunksReceived++;
              const dur = (this.totalPcmBytes / 2 / SAMPLE_RATE).toFixed(1);
              const dbg = `chunks=${this.chunksReceived} bytes=${this.totalPcmBytes} dur=${dur}s`;
              console.warn('[VoiceAudio]', dbg);
              this.callbacks.onDebug?.(dbg);
              this.callbacks.onAudioActivity();
            } else if (msg.type === 'text' && msg.data) {
              this.callbacks.onText(msg.data);
            } else if (msg.type === 'video' && msg.data) {
              const raw = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
              const blob = new Blob([raw], { type: 'image/jpeg' });
              this.callbacks.onVideoFrame(blob);
            } else if (msg.type === 'state' && msg.state) {
              console.warn('[VoiceAudio] state:', msg.state);
              if (msg.state === 'speaking') {
                // Clear buffer for new response
                this.stopAudio();
                this.pcmChunks = [];
                this.totalPcmBytes = 0;
                this.chunksReceived = 0;
              }
              if (msg.state === 'listening' && this.totalPcmBytes > 0) {
                // Speaking ended — play accumulated audio as single WAV
                this.playAccumulatedAsWav();
              }
              this.callbacks.onStateChange(msg.state as VoicePipelineState);
            }
          } catch {
            /* ignore malformed JSON */
          }
        }
      };

      this.ws!.onerror = () => {
        clearTimeout(timeout);
        this.callbacks.onError('WebSocket error');
        reject(new Error('WebSocket error'));
      };

      this.ws!.onclose = () => {
        this.callbacks.onClose();
      };
    });

    await this.startMicCapture(preCreatedMicStream);
  }

  /** Concatenate accumulated PCM chunks into a WAV and play via Audio element. */
  private playAccumulatedAsWav(): void {
    if (this.pcmChunks.length === 0) return;

    // Concatenate all PCM byte chunks
    const combined = new Uint8Array(this.totalPcmBytes);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBlob = buildWavBlob(combined, SAMPLE_RATE);
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    this.blobUrl = URL.createObjectURL(wavBlob);

    const audio = new Audio(this.blobUrl);
    this.audioElement = audio;
    audio.play().catch((e) => {
      console.error('Voice playback failed:', e);
    });

    const dur = (this.totalPcmBytes / 2 / SAMPLE_RATE).toFixed(1);
    const dbg = `PLAYING: chunks=${this.chunksReceived} dur=${dur}s`;
    console.warn('[VoiceAudio]', dbg);
    this.callbacks.onDebug?.(dbg);

    // Clear buffer so it doesn't replay on the next state cycle
    this.pcmChunks = [];
    this.totalPcmBytes = 0;
    this.chunksReceived = 0;
  }

  private stopAudio(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
      this.blobUrl = null;
    }
  }

  private async startMicCapture(preCreatedStream?: MediaStream): Promise<void> {
    if (preCreatedStream) {
      this.mediaStream = preCreatedStream;
    } else {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    }

    // @ts-expect-error - opus-recorder has no types
    const Recorder = (await import('opus-recorder')).default;

    this.recorder = new Recorder({
      encoderPath: '/assets/opus-recorder/encoderWorker.min.js',
      encoderSampleRate: SAMPLE_RATE,
      encoderFrameSize: 20,
      encoderApplication: 2049,
      streamPages: true,
      numberOfChannels: 1,
    });

    (this.recorder as { ondataavailable: (data: ArrayBuffer) => void }).ondataavailable =
      (oggPage: ArrayBuffer) => {
        if (this.ws?.readyState === WebSocket.OPEN && !this.isMuted) {
          const frame = new Uint8Array(oggPage.byteLength + 1);
          frame[0] = 0x01;
          frame.set(new Uint8Array(oggPage), 1);
          this.ws.send(frame.buffer);
        }
      };

    await (this.recorder as { start: (stream: MediaStream) => Promise<void> }).start(
      this.mediaStream,
    );
  }

  sendEndOfUtterance(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const signal = new Uint8Array([0x05]);
      this.ws.send(signal.buffer);
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  async disconnect(): Promise<void> {
    this.stopAudio();

    if (this.recorder) {
      try {
        await (this.recorder as { stop: () => Promise<void> }).stop();
      } catch { /* ignore */ }
      this.recorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      await this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.gainNode = null;
  }
}

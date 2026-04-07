/**
 * Voice pipeline audio bridge — handles audio I/O for the turn-based voice pipeline.
 *
 * Protocol:
 *   Client → Sidecar:
 *     \x01 + Ogg Opus bytes = user audio (mic recording)
 *     \x05                   = end-of-utterance signal
 *
 *   Sidecar → Client:
 *     \x01 + int16 LE PCM bytes = TTS audio (48kHz mono)
 *     \x02 + UTF-8              = text (conversation transcript)
 *     \x04 + JPEG bytes         = lip-synced video frame
 *     \x06 + JSON               = state change (listening/thinking/speaking)
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
}

/**
 * VoiceAudioBridge manages the audio pipeline for a turn-based voice session.
 */
export class VoiceAudioBridge {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private recorder: unknown = null;

  // Playback scheduling
  private nextPlayTime = 0;
  private gainNode: GainNode | null = null;

  private callbacks: VoiceAudioCallbacks;
  private isMuted = false;

  constructor(callbacks: VoiceAudioCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Connect to the voice pipeline sidecar WebSocket.
   */
  async connect(wsUrl: string, preCreatedAudioCtx?: AudioContext, preCreatedMicStream?: MediaStream): Promise<void> {
    // 1. AudioContext setup
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
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);
    this.nextPlayTime = this.audioCtx.currentTime;

    // 2. Connect WebSocket
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
        if (!(event.data instanceof ArrayBuffer)) return;
        const data = new Uint8Array(event.data);
        if (data.length === 0) return;

        const kind = data[0];

        if (kind === 0x01 && data.length > 1) {
          // Int16 LE PCM audio from TTS — copy to aligned buffer
          // (byte offset 1 is not Int16-aligned, so we must copy)
          const rawBytes = data.slice(1);
          const aligned = new ArrayBuffer(rawBytes.length);
          new Uint8Array(aligned).set(rawBytes);
          const int16 = new Int16Array(aligned);
          const pcm = new Float32Array(int16.length);
          for (let i = 0; i < int16.length; i++) {
            pcm[i] = int16[i] / 32768;
          }
          this.schedulePlayback(pcm);
          this.callbacks.onAudioActivity();
        } else if (kind === 0x02 && data.length > 1) {
          // Text (conversation transcript)
          const text = new TextDecoder().decode(data.slice(1));
          this.callbacks.onText(text);
        } else if (kind === 0x04 && data.length > 1) {
          // JPEG video frame from LivePortrait
          const jpegData = data.slice(1);
          const blob = new Blob([jpegData], { type: 'image/jpeg' });
          this.callbacks.onVideoFrame(blob);
        } else if (kind === 0x06 && data.length > 1) {
          // State change from pipeline
          try {
            const json = JSON.parse(new TextDecoder().decode(data.slice(1)));
            if (json.state) {
              this.callbacks.onStateChange(json.state as VoicePipelineState);
            }
          } catch { /* ignore malformed state */ }
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

    // 3. Start mic capture + Opus encoding
    await this.startMicCapture(preCreatedMicStream);
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

    // Use opus-recorder for encoding (same as before — sidecar decodes on its end)
    // @ts-expect-error - opus-recorder has no types
    const Recorder = (await import('opus-recorder')).default;

    this.recorder = new Recorder({
      encoderPath: '/assets/opus-recorder/encoderWorker.min.js',
      encoderSampleRate: SAMPLE_RATE,
      encoderFrameSize: 20,
      encoderApplication: 2049, // VOIP
      streamPages: true,
      numberOfChannels: 1,
    });

    (this.recorder as { ondataavailable: (data: ArrayBuffer) => void }).ondataavailable =
      (oggPage: ArrayBuffer) => {
        if (this.ws?.readyState === WebSocket.OPEN && !this.isMuted) {
          const frame = new Uint8Array(oggPage.byteLength + 1);
          frame[0] = 0x01; // audio kind byte
          frame.set(new Uint8Array(oggPage), 1);
          this.ws.send(frame.buffer);
        }
      };

    await (this.recorder as { start: (stream: MediaStream) => Promise<void> }).start(
      this.mediaStream,
    );
  }

  /** Send end-of-utterance signal to the sidecar. */
  sendEndOfUtterance(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const signal = new Uint8Array([0x05]);
      this.ws.send(signal.buffer);
    }
  }

  /** Schedule PCM playback via AudioContext buffer source. */
  private schedulePlayback(pcm: Float32Array): void {
    if (!this.audioCtx || !this.gainNode) return;

    const buffer = this.audioCtx.createBuffer(1, pcm.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(pcm);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    const startTime = Math.max(this.audioCtx.currentTime + 0.01, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + buffer.duration;
  }

  /** Mute/unmute the microphone. */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /** Clean up all resources. */
  async disconnect(): Promise<void> {
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

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
  private _chunksReceived = 0;
  private _chunksPlayed = 0;

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
        // Server sends JSON text frames (avoids Cloudflare binary fragmentation)
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as {
              type: string;
              data?: string;
              state?: string;
            };

            if (msg.type === 'audio' && msg.data) {
              // Base64 → Int16 LE PCM → Float32
              const raw = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
              const aligned = new ArrayBuffer(raw.length);
              new Uint8Array(aligned).set(raw);
              const int16 = new Int16Array(aligned);
              const pcm = new Float32Array(int16.length);
              for (let i = 0; i < int16.length; i++) {
                pcm[i] = int16[i] / 32768;
              }
              this._chunksReceived++;
              this.schedulePlayback(pcm);
              const info = `pcm=${pcm.length} rate=${SAMPLE_RATE} ctx=${this.audioCtx?.sampleRate} recv=${this._chunksReceived} play=${this._chunksPlayed}`;
              this.callbacks.onDebug?.(info);
              this.callbacks.onAudioActivity();
            } else if (msg.type === 'text' && msg.data) {
              this.callbacks.onText(msg.data);
            } else if (msg.type === 'video' && msg.data) {
              const raw = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
              const blob = new Blob([raw], { type: 'image/jpeg' });
              this.callbacks.onVideoFrame(blob);
            } else if (msg.type === 'state' && msg.state) {
              this.callbacks.onStateChange(msg.state as VoicePipelineState);
            }
          } catch {
            /* ignore malformed JSON */
          }
          return;
        }

        // Legacy binary fallback (for any remaining binary messages)
        if (!(event.data instanceof ArrayBuffer)) return;
        const data = new Uint8Array(event.data);
        if (data.length === 0) return;
        // Binary messages from client side (mic audio) are not echoed back,
        // so we shouldn't receive binary from the server anymore.
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

    // Client → Server: still uses binary Opus frames (client sends, not affected by CF)
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
    source.playbackRate.value = 1.0;
    source.connect(this.gainNode);

    // If nextPlayTime has fallen behind current time (gap between turns),
    // reset it so we don't schedule in the past.
    if (this.nextPlayTime < this.audioCtx.currentTime) {
      this.nextPlayTime = this.audioCtx.currentTime + 0.005;
    }
    source.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;
    this._chunksPlayed++;
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

/**
 * Moshi audio bridge — handles Opus encoding/decoding for the binary WebSocket protocol.
 *
 * Protocol: \x01 + Ogg Opus bytes (audio), \x02 + UTF-8 (text), \x00 (handshake)
 *
 * Encoding (mic → Moshi):
 *   getUserMedia → opus-recorder (Ogg Opus stream pages) → prepend \x01 → WS send
 *
 * Decoding (Moshi → speaker):
 *   WS recv → strip \x01 → decoderWorker (Ogg Opus → PCM) → AudioWorklet playback
 */

const SAMPLE_RATE = 24000;

/** Callback types */
export interface MoshiAudioCallbacks {
  onHandshake: () => void;
  onText: (text: string) => void;
  onAudioActivity: (active: boolean) => void;
  onVideoFrame: (jpegBlob: Blob) => void;
  onError: (error: string) => void;
  onClose: () => void;
}

/**
 * MoshiAudioBridge manages the full audio pipeline for a Moshi WebSocket session.
 */
export class MoshiAudioBridge {
  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private decoderWorker: Worker | null = null;
  private recorder: unknown = null;

  // Playback scheduling
  private nextPlayTime = 0;
  private gainNode: GainNode | null = null;

  private callbacks: MoshiAudioCallbacks;
  private isMuted = false;

  constructor(callbacks: MoshiAudioCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Connect to Moshi WebSocket and start audio pipeline.
   * @param wsUrl WebSocket URL for the Moshi sidecar
   * @param preCreatedAudioCtx Optional AudioContext created earlier during user gesture.
   *   On Safari/iOS, AudioContext must be created within a user gesture handler.
   *   If the caller does async work (health polling) before calling connect(),
   *   the gesture context expires. Pass a pre-created AudioContext to avoid this.
   */
  async connect(
    wsUrl: string,
    preCreatedAudioCtx?: AudioContext,
  ): Promise<void> {
    // 1. Use pre-created AudioContext or create a new one
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

    // 2. Set up Opus decoder worker
    this.decoderWorker = new Worker(
      '/assets/opus-recorder/decoderWorker.min.js',
    );
    this.decoderWorker.postMessage({
      command: 'init',
      decoderSampleRate: SAMPLE_RATE,
      outputBufferSampleRate: SAMPLE_RATE,
      resampleQuality: 3,
      bufferLength: 4096,
    });

    // Decoder sends back PCM Float32Array buffers
    this.decoderWorker.onmessage = (e: MessageEvent) => {
      if (e.data === null) return; // end of stream signal
      // e.data is an array of Float32Array (one per channel, mono = 1)
      const pcm: Float32Array = e.data[0];
      if (pcm && pcm.length > 0) {
        this.schedulePlayback(pcm);
        this.callbacks.onAudioActivity(true);
      }
    };

    // 3. Connect WebSocket
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    await new Promise<void>((resolve, reject) => {
      // Long timeout: Moshi model may still be loading even after sidecar is up
      const timeout = setTimeout(
        () => reject(new Error('WebSocket connection timeout')),
        120000,
      );

      this.ws!.onopen = () => {
        clearTimeout(timeout);
      };

      this.ws!.onmessage = (event: MessageEvent) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const data = new Uint8Array(event.data);
        if (data.length === 0) return;

        const kind = data[0];
        if (kind === 0) {
          // Handshake received
          this.callbacks.onHandshake();
          resolve();
        } else if (kind === 1 && data.length > 1) {
          // Ogg Opus audio — send to decoder worker
          const oggData = data.slice(1);
          this.decoderWorker?.postMessage(
            { command: 'decode', pages: oggData },
            [oggData.buffer],
          );
        } else if (kind === 2 && data.length > 1) {
          // Text (inner monologue)
          const text = new TextDecoder().decode(data.slice(1));
          this.callbacks.onText(text);
        } else if (kind === 4 && data.length > 1) {
          // JPEG video frame from MuseTalk sidecar
          const jpegData = data.slice(1);
          const blob = new Blob([jpegData], { type: 'image/jpeg' });
          this.callbacks.onVideoFrame(blob);
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

    // 4. Start mic capture + Opus encoding
    await this.startMicCapture();
  }

  private async startMicCapture(): Promise<void> {
    // Note: sampleRate constraint is NOT supported on Safari iOS — omit it
    // and let opus-recorder's built-in resampler handle the conversion.
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Use opus-recorder for encoding
    // @ts-expect-error - opus-recorder has no types
    const Recorder = (await import('opus-recorder')).default;

    this.recorder = new Recorder({
      encoderPath: '/assets/opus-recorder/encoderWorker.min.js',
      encoderSampleRate: SAMPLE_RATE,
      encoderFrameSize: 20, // 20ms frames
      encoderApplication: 2049, // VOIP
      streamPages: true,
      numberOfChannels: 1,
    });

    // When encoder produces Ogg Opus pages, send to WebSocket
    (
      this.recorder as { ondataavailable: (data: ArrayBuffer) => void }
    ).ondataavailable = (oggPage: ArrayBuffer) => {
      if (this.ws?.readyState === WebSocket.OPEN && !this.isMuted) {
        const frame = new Uint8Array(oggPage.byteLength + 1);
        frame[0] = 1; // audio kind byte
        frame.set(new Uint8Array(oggPage), 1);
        this.ws.send(frame.buffer);
      }
    };

    await (
      this.recorder as { start: (stream: MediaStream) => Promise<void> }
    ).start(this.mediaStream);
  }

  /** Schedule PCM playback via AudioContext buffer source. */
  private schedulePlayback(pcm: Float32Array): void {
    if (!this.audioCtx || !this.gainNode) return;

    // Use the decoder's output rate (24kHz from Moshi) — AudioContext handles resampling
    const buffer = this.audioCtx.createBuffer(1, pcm.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(pcm);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    const startTime = Math.max(
      this.audioCtx.currentTime + 0.01,
      this.nextPlayTime,
    );
    source.start(startTime);
    this.nextPlayTime = startTime + buffer.duration;
  }

  /** Mute/unmute the microphone. */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    // Also mute the actual mic track for the recording indicator
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /** Clean up all resources. */
  async disconnect(): Promise<void> {
    // Stop recorder
    if (this.recorder) {
      try {
        await (this.recorder as { stop: () => Promise<void> }).stop();
      } catch {
        /* ignore */
      }
      this.recorder = null;
    }

    // Stop mic tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    // Close decoder worker
    if (this.decoderWorker) {
      this.decoderWorker.postMessage({ command: 'done' });
      this.decoderWorker.terminate();
      this.decoderWorker = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Close audio context
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      await this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.gainNode = null;
  }
}

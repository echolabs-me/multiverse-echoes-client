/**
 * Voice pipeline audio bridge.
 *
 * Audio transport (split):
 *   Client mic → Opus over WebSocket (tunnel) → sidecar → Whisper STT
 *   VoxCPM2 TTS → sidecar → CF Calls ingress adapter → WebRTC → client <audio>
 *
 * Control transport (WebSocket through tunnel):
 *   Client → Sidecar:
 *     Binary: \x01 + Ogg Opus = mic audio
 *     Binary: \x05            = end-of-utterance
 *     JSON:   {"type":"webrtc_answer","sessionDescription":{...}}
 *
 *   Sidecar → Client:
 *     {"type":"text","data":"..."}       = transcript
 *     {"type":"video","data":"..."}      = JPEG frame
 *     {"type":"state","state":"..."}     = state change
 *     {"type":"webrtc_offer",...}         = CF Calls SDP offer (TTS track)
 */

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

const SAMPLE_RATE = 24000;

export class VoiceAudioBridge {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private recorder: unknown = null;
  private remoteAudio: HTMLAudioElement | null = null;

  private callbacks: VoiceAudioCallbacks;

  constructor(callbacks: VoiceAudioCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Connect to the voice pipeline.
   * @param wsUrl WebSocket URL for mic audio + text/video/state
   * @param remoteAudioEl <audio> element for WebRTC TTS playback
   * @param preCreatedAudioCtx Pre-created AudioContext (Safari gesture)
   * @param preCreatedMicStream Pre-created mic stream (Safari gesture)
   */
  async connect(
    wsUrl: string,
    remoteAudioEl: HTMLAudioElement,
    preCreatedAudioCtx?: AudioContext,
    preCreatedMicStream?: MediaStream,
  ): Promise<void> {
    this.remoteAudio = remoteAudioEl;

    // AudioContext for Opus recorder
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

    // WebSocket for mic audio + text/video/state
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket timeout')), 30000);

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
              clientSessionId?: string;
              sessionDescription?: { sdp: string; type: string };
              requiresImmediateRenegotiation?: boolean;
            };

            if (msg.type === 'webrtc_offer') {
              void this.handleWebRTCOffer(msg);
            } else if (msg.type === 'text' && msg.data) {
              this.callbacks.onText(msg.data);
            } else if (msg.type === 'video' && msg.data) {
              const raw = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
              const blob = new Blob([raw], { type: 'image/jpeg' });
              this.callbacks.onVideoFrame(blob);
            } else if (msg.type === 'state' && msg.state) {
              if (msg.state === 'audio_error') {
                this.callbacks.onError('Audio transport error');
              } else {
                this.callbacks.onStateChange(msg.state as VoicePipelineState);
                if (msg.state === 'speaking') {
                  this.callbacks.onAudioActivity();
                }
              }
            }
          } catch {
            /* ignore */
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

    // Start mic capture via Opus recorder (sends \x01 on WebSocket)
    await this.startMicCapture(preCreatedMicStream);
  }

  /** Handle WebRTC offer from server — sets up receive-only PeerConnection for TTS audio. */
  private async handleWebRTCOffer(msg: {
    clientSessionId?: string;
    sessionDescription?: { sdp: string; type: string };
  }): Promise<void> {
    const t0 = performance.now();
    const ts = () => `${((performance.now() - t0) / 1000).toFixed(1)}s`;

    try {
      console.log(`[voice] ${ts()} webrtc_offer received`);

      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
        bundlePolicy: 'max-bundle',
      });

      this.pc.oniceconnectionstatechange = () => {
        console.log(`[voice] ICE: ${this.pc?.iceConnectionState}`);
      };

      this.pc.ontrack = (event) => {
        console.log(`[voice] ${ts()} Remote track: ${event.track.kind} id=${event.track.id} muted=${event.track.muted}`);
        if (this.remoteAudio) {
          this.remoteAudio.srcObject = event.streams?.[0]
            ? event.streams[0]
            : new MediaStream([event.track]);
          console.log(`[voice] ${ts()} Audio element: srcObject=${!!this.remoteAudio.srcObject} paused=${this.remoteAudio.paused}`);
          this.remoteAudio.play().then(() => {
            console.log(`[voice] ${ts()} Audio play() succeeded`);
          }).catch((e) => {
            console.error(`[voice] ${ts()} Audio play() FAILED: ${e.message}`);
          });
        }
        event.track.onunmute = () => console.log(`[voice] ${ts()} Track unmuted`);
        event.track.onmute = () => console.log(`[voice] ${ts()} Track muted`);
      };

      this.pc.addTransceiver('audio', { direction: 'recvonly' });
      console.log(`[voice] ${ts()} addTransceiver done`);

      if (msg.sessionDescription) {
        await this.pc.setRemoteDescription(
          new RTCSessionDescription(msg.sessionDescription as RTCSessionDescriptionInit),
        );
        console.log(`[voice] ${ts()} setRemoteDescription done`);
      }

      const answer = await this.pc.createAnswer();
      console.log(`[voice] ${ts()} createAnswer done`);

      await this.pc.setLocalDescription(answer);
      console.log(`[voice] ${ts()} setLocalDescription done`);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'webrtc_answer',
          sessionDescription: {
            sdp: this.pc.localDescription?.sdp,
            type: 'answer',
          },
        }));
        console.log(`[voice] ${ts()} webrtc_answer SENT`);
      }
    } catch (e) {
      console.error(`[voice] ${ts()} WebRTC setup FAILED: ${e}`);
    }
  }

  /** Start Opus mic recording — sends \x01 frames on WebSocket (unchanged). */
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
        if (this.ws?.readyState === WebSocket.OPEN) {
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
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.remoteAudio) {
      this.remoteAudio.pause();
      this.remoteAudio.srcObject = null;
      this.remoteAudio = null;
    }

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
  }
}

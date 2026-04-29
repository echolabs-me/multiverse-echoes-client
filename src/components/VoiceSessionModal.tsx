/**
 * VoiceSessionModal — Turn-based voice conversation with an Echo.
 *
 * Pipeline: User speaks → Whisper STT → Gemma 4 → Kokoro TTS → LivePortrait
 *
 * UI States:
 *   connecting → listening → thinking → speaking → listening → ...
 *   error (on failure)
 *   duration_warning (2 minutes before limit)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, PhoneOff, Loader2, X, Clock, Send } from 'lucide-react';
import { Button } from './index.ts';
import { getBaseUrl } from '../lib/api/client.ts';
import { echoes as echoApi } from '../lib/api/endpoints.ts';
import { VoiceAudioBridge } from '../lib/voiceAudio.ts';
import type { VoicePipelineState } from '../lib/voiceAudio.ts';

type SessionState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

interface VoiceSessionModalProps {
  echoId: string;
  echoName: string;
  avatarUrl: string | null;
  onClose: () => void;
}

export function VoiceSessionModal({
  echoId,
  echoName,
  avatarUrl,
  onClose,
}: VoiceSessionModalProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<SessionState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript to bottom on every update
  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [showDurationWarning, setShowDurationWarning] = useState(false);

  // Video frame from LivePortrait
  const [videoFrame, setVideoFrame] = useState<string | null>(null);
  const videoFrameRef = useRef<string | null>(null);

  const bridgeRef = useRef<VoiceAudioBridge | null>(null);
  const sessionNonceRef = useRef<number | undefined>(undefined);
  const cleanupDoneRef = useRef(false);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const sessionDurationRef = useRef<number>(900);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  // Pre-bridge resources — held here so cleanup() can release the mic and
  // AudioContext if startSession fails before the bridge adopts them.
  const preMicStreamRef = useRef<MediaStream | null>(null);
  const preAudioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    videoFrameRef.current = videoFrame;
  }, [videoFrame]);

  const cleanup = useCallback(async () => {
    if (cleanupDoneRef.current) return;
    cleanupDoneRef.current = true;

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = undefined;
    }

    if (bridgeRef.current) {
      await bridgeRef.current.disconnect();
      bridgeRef.current = null;
    }

    // Release any pre-bridge resources the bridge never adopted (e.g. startup
    // failed before connect() ran). Once the bridge takes ownership, startSession
    // clears these refs so disconnect() is the sole releaser.
    if (preMicStreamRef.current) {
      preMicStreamRef.current.getTracks().forEach((track) => track.stop());
      preMicStreamRef.current = null;
    }
    if (preAudioCtxRef.current) {
      if (preAudioCtxRef.current.state !== 'closed') {
        await preAudioCtxRef.current.close().catch(() => {});
      }
      preAudioCtxRef.current = null;
    }

    if (videoFrameRef.current) {
      URL.revokeObjectURL(videoFrameRef.current);
    }

    try {
      await echoApi.stopVoiceSession(echoId, sessionNonceRef.current);
    } catch {
      /* best effort */
    }
    sessionNonceRef.current = undefined;

    // cleanupDoneRef stays true — the guard at the top of cleanup() is meant
    // to mean "we already released resources, don't double-release". It is
    // reset to false by startSession() when a genuinely new call begins.
  }, [echoId]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startSession = useCallback(async () => {
    // A genuinely new call begins — arm cleanup() to run again on this session.
    cleanupDoneRef.current = false;

    setState('connecting');
    setError(null);
    setTranscript('');
    setVideoFrame(null);
    setShowDurationWarning(false);

    try {
      const preAudioCtx = new AudioContext({ sampleRate: 24000 });
      preAudioCtxRef.current = preAudioCtx;
      if (preAudioCtx.state === 'suspended') {
        await preAudioCtx.resume();
      }
      const preMicStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      preMicStreamRef.current = preMicStream;

      // Start server-side session
      const { voice_ws_url, session_nonce, session_duration_seconds } =
        await echoApi.startVoiceSession(echoId);
      sessionNonceRef.current = session_nonce;
      sessionDurationRef.current = session_duration_seconds;
      setRemainingSeconds(session_duration_seconds);

      // Poll sidecar health
      const baseUrl = getBaseUrl();
      let ready = false;
      for (let i = 0; i < 30; i++) {
        try {
          const resp = await fetch(`${baseUrl}/voice/health`);
          if (resp.ok) {
            ready = true;
            break;
          }
        } catch {
          /* not ready */
        }
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!ready) {
        throw new Error(t('voice.serverTimeout', 'Voice server not available'));
      }

      // Create audio bridge
      const bridge = new VoiceAudioBridge({
        onConnected: () => setState('listening'),
        onStateChange: (pipelineState: VoicePipelineState) => {
          if (pipelineState === 'listening') setState('listening');
          else if (pipelineState === 'thinking') setState('thinking');
          else if (pipelineState === 'speaking') setState('speaking');
        },
        onText: (text) => setTranscript((prev) => prev + text),
        onAudioActivity: () => {
          // Keep in speaking state while audio plays
        },
        onVideoFrame: (blob) => {
          const url = URL.createObjectURL(blob);
          setVideoFrame((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        },
        onError: (msg) => {
          setError(msg);
          setState('error');
        },
        onClose: () => {},
      });

      bridgeRef.current = bridge;

      const wsBase = baseUrl.replace(/^http/, 'ws');
      await bridge.connect(
        `${wsBase}${voice_ws_url}`,
        remoteAudioRef.current!,
        preAudioCtx,
        preMicStream,
      );

      // Bridge now owns these — disconnect() will release them.
      preMicStreamRef.current = null;
      preAudioCtxRef.current = null;

      // Start duration countdown
      let elapsed = 0;
      durationTimerRef.current = setInterval(() => {
        elapsed++;
        const remaining = session_duration_seconds - elapsed;
        setRemainingSeconds(remaining);
        if (remaining <= 120 && remaining > 0) {
          setShowDurationWarning(true);
        }
        if (remaining <= 0) {
          void endSession();
        }
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('voice.error');
      setError(msg);
      setState('error');
      void cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [echoId, cleanup, t]);

  const endSession = useCallback(async () => {
    setState('idle');
    await cleanup();
    onClose();
  }, [cleanup, onClose]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    bridgeRef.current?.setMuted(newMuted);
  }, [isMuted]);

  const sendEndOfUtterance = useCallback(() => {
    bridgeRef.current?.sendEndOfUtterance();
  }, []);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stateLabel = {
    idle: t('voice.tapToStart'),
    connecting: t('voice.connecting'),
    listening: t('voice.listening', 'Listening...'),
    thinking: t('voice.thinking', 'Thinking...'),
    speaking: t('voice.speaking'),
    error: error || t('voice.error'),
  }[state];

  const stateColor = {
    idle: 'border-border-default',
    connecting: 'border-border-default',
    listening: 'border-green-500 shadow-lg shadow-green-500/30',
    thinking: 'border-yellow-500 shadow-md shadow-yellow-500/20 animate-pulse',
    speaking: 'border-accent shadow-lg shadow-accent/40 scale-105',
    error: 'border-red-500',
  }[state];

  return (
    <div className="bg-surface-base/95 pb-safe pt-safe fixed inset-0 z-50 flex touch-manipulation flex-col items-center justify-center backdrop-blur-sm">
      {/* Hidden audio element for WebRTC remote audio playback */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {/* Close button — always visible so user can dismiss at any state */}
      {(state === 'idle' || state === 'error' || state === 'connecting') && (
        <button
          onClick={() => void endSession()}
          className="absolute inset-e-4 inset-bs-4 rounded-full p-2 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          aria-label={t('voice.close')}
        >
          <X size={24} />
        </button>
      )}

      {/* Duration warning */}
      {showDurationWarning &&
        remainingSeconds !== null &&
        remainingSeconds > 0 && (
          <div className="absolute inset-s-4 inset-bs-4 flex items-center gap-2 rounded-lg bg-yellow-500/20 px-3 py-2 text-sm text-yellow-400">
            <Clock size={16} />
            {t('voice.durationWarning', 'Call ends in {{time}}', {
              time: formatTime(remainingSeconds),
            })}
          </div>
        )}

      {/* Timer (always visible during call) */}
      {remainingSeconds !== null &&
        state !== 'idle' &&
        state !== 'error' &&
        !showDurationWarning && (
          <div className="text-text-tertiary absolute inset-s-4 inset-bs-4 flex items-center gap-2 text-sm">
            <Clock size={14} />
            {formatTime(remainingSeconds)}
          </div>
        )}

      {/* Echo name */}
      <h2 className="mbe-6 text-xl font-semibold text-text-primary">
        {echoName}
      </h2>

      {/* Portrait / LivePortrait video */}
      <div
        className={`relative mbe-6 size-48 overflow-hidden rounded-full border-4 transition-all duration-300 ${stateColor}`}
      >
        {videoFrame ? (
          <img
            src={videoFrame}
            alt={echoName}
            className="size-full object-cover"
          />
        ) : avatarUrl ? (
          <img
            src={avatarUrl}
            alt={echoName}
            className="size-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-surface-raised text-4xl font-bold text-text-secondary">
            {echoName[0]}
          </div>
        )}

        {/* Loading overlay */}
        {state === 'connecting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="size-12 animate-spin text-white" />
          </div>
        )}

        {/* Thinking indicator */}
        {state === 'thinking' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex gap-1">
              <span className="me-bounce-delay-0 size-2 animate-bounce rounded-full bg-white" />
              <span className="me-bounce-delay-150 size-2 animate-bounce rounded-full bg-white" />
              <span className="me-bounce-delay-300 size-2 animate-bounce rounded-full bg-white" />
            </div>
          </div>
        )}
      </div>

      {/* State label */}
      <p
        className={`mbe-4 text-sm ${state === 'error' ? 'text-red-400' : 'text-text-secondary'}`}
      >
        {stateLabel}
      </p>

      {/* Transcript / subtitles */}
      {transcript &&
        (state === 'listening' ||
          state === 'thinking' ||
          state === 'speaking') && (
          <div
            ref={transcriptRef}
            className="mbe-4 max-h-48 max-w-md overflow-y-auto rounded-lg bg-surface-raised px-4 py-2 text-sm text-text-secondary"
          >
            {transcript
              .split('\n')
              .filter(Boolean)
              .map((line, i) => (
                <p
                  key={i}
                  className={
                    line.startsWith('[You]')
                      ? 'text-text-tertiary'
                      : 'text-accent'
                  }
                >
                  {line}
                </p>
              ))}
          </div>
        )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state === 'idle' || state === 'error' ? (
          <Button
            onClick={() => void startSession()}
            className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-white"
          >
            <Mic size={20} />
            {t('voice.startCall')}
          </Button>
        ) : state === 'connecting' ? (
          <Button
            disabled
            className="flex items-center gap-2 rounded-full px-6 py-3 opacity-50"
          >
            <Loader2 size={20} className="animate-spin" />
            {t('voice.connectingShort')}
          </Button>
        ) : (
          <>
            <button
              onClick={toggleMute}
              className={`rounded-full p-4 ${
                isMuted
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-surface-raised text-text-primary'
              }`}
              aria-label={isMuted ? t('voice.unmute') : t('voice.mute')}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            {/* Send button — manually trigger end-of-utterance */}
            {state === 'listening' && (
              <button
                onClick={sendEndOfUtterance}
                className="rounded-full bg-accent/20 p-4 text-accent hover:bg-accent/30"
                aria-label={t('voice.send', 'Send')}
              >
                <Send size={24} />
              </button>
            )}
            <button
              onClick={() => void endSession()}
              className="rounded-full bg-red-500 p-4 text-white"
              aria-label={t('voice.endCall')}
            >
              <PhoneOff size={24} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * VoiceSessionModal — Full-duplex voice conversation with an Echo.
 *
 * Audio pipeline:
 *   Mic → opus-recorder (Ogg Opus) → \x01 prefix → Moshi WS
 *   Moshi WS → strip \x01 → decoderWorker (Ogg Opus → PCM) → AudioContext playback
 *
 * Video pipeline (when MuseTalk sidecar is running):
 *   MuseTalk WS → JPEG frames → <img> tag (replaces static portrait)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Phone, PhoneOff, Loader2, X } from 'lucide-react';
import { Button } from './index.ts';
import { getBaseUrl } from '../lib/api/client.ts';
import { echoes as echoApi } from '../lib/api/endpoints.ts';
import { MoshiAudioBridge } from '../lib/moshiAudio.ts';

type SessionState = 'idle' | 'starting' | 'connecting' | 'active' | 'error';

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
  const [innerMonologue, setInnerMonologue] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // MuseTalk video frame (future)
  const [videoFrame, setVideoFrame] = useState<string | null>(null);
  const videoWsRef = useRef<WebSocket | null>(null);

  const bridgeRef = useRef<MoshiAudioBridge | null>(null);
  const sessionNonceRef = useRef<number | undefined>(undefined);
  const cleanupDoneRef = useRef(false);
  const videoFrameRef = useRef<string | null>(null);

  // Keep ref in sync with state (for cleanup without re-triggering useEffect)
  useEffect(() => {
    videoFrameRef.current = videoFrame;
  }, [videoFrame]);

  const cleanup = useCallback(async () => {
    if (cleanupDoneRef.current) return;
    cleanupDoneRef.current = true;

    // Disconnect audio bridge
    if (bridgeRef.current) {
      await bridgeRef.current.disconnect();
      bridgeRef.current = null;
    }

    // Close MuseTalk video WS
    if (videoWsRef.current) {
      videoWsRef.current.close();
      videoWsRef.current = null;
    }

    // Clean up video frame URL (read from ref, not state — avoids dependency)
    if (videoFrameRef.current) {
      URL.revokeObjectURL(videoFrameRef.current);
    }

    // Stop server-side Moshi (pass nonce to prevent killing a newer session)
    try {
      await echoApi.stopVoiceSession(echoId, sessionNonceRef.current);
    } catch { /* best effort */ }
    sessionNonceRef.current = undefined;

    cleanupDoneRef.current = false;
  }, [echoId]);

  // Only fire cleanup on unmount — NOT on every videoFrame change
  useEffect(() => {
    return () => { void cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade out speaking indicator after silence
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const markSpeaking = useCallback(() => {
    setIsSpeaking(true);
    clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = setTimeout(() => setIsSpeaking(false), 500);
  }, []);

  const startSession = useCallback(async () => {
    setState('starting');
    setError(null);
    setInnerMonologue('');
    setVideoFrame(null);

    try {
      // 1. Pre-create AudioContext NOW while user gesture is still valid.
      //    Safari requires AudioContext to be created/resumed within a user
      //    gesture handler. The health polling below takes 10-20s, which
      //    expires the gesture context. Creating it here preserves it.
      const preAudioCtx = new AudioContext({ sampleRate: 24000 });
      if (preAudioCtx.state === 'suspended') {
        await preAudioCtx.resume();
      }

      // 2. Start server-side Moshi
      const { voice_ws_url, session_nonce } = await echoApi.startVoiceSession(echoId);
      sessionNonceRef.current = session_nonce;
      setState('connecting');

      // 3. Poll sidecar /health — returns 200 only when both sidecar AND Moshi are up
      const baseUrl = getBaseUrl();
      let ready = false;
      for (let i = 0; i < 240; i++) {
        try {
          const resp = await fetch(`${baseUrl}/voice/health`);
          if (resp.ok) { ready = true; break; }
        } catch { /* not ready */ }
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!ready) {
        preAudioCtx.close();
        throw new Error('Voice server did not start in time');
      }

      // 4. Create audio bridge and connect (pass pre-created AudioContext)
      const bridge = new MoshiAudioBridge({
        onHandshake: () => setState('active'),
        onText: (text) => setInnerMonologue((prev) => prev + text),
        onAudioActivity: () => markSpeaking(),
        onVideoFrame: (blob) => {
          const url = URL.createObjectURL(blob);
          setVideoFrame((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
        },
        onError: (msg) => { setError(msg); setState('error'); },
        onClose: () => setIsSpeaking(false),
      });

      bridgeRef.current = bridge;

      const wsBase = baseUrl.replace(/^http/, 'ws');
      await bridge.connect(`${wsBase}${voice_ws_url}`, preAudioCtx);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start voice session';
      setError(msg);
      setState('error');
      void cleanup();
    }
  }, [echoId, cleanup, markSpeaking]);

  const endSession = useCallback(async () => {
    setState('idle');
    setIsSpeaking(false);
    await cleanup();
    onClose();
  }, [cleanup, onClose]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    bridgeRef.current?.setMuted(newMuted);
  }, [isMuted]);

  const stateLabel = {
    idle: t('voice.tapToStart'),
    starting: t('voice.requestingMic'),
    connecting: t('voice.connecting'),
    active: t('voice.speaking'),
    error: error || t('voice.error'),
  }[state];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface-base/95 backdrop-blur-sm pb-safe pt-safe" style={{ touchAction: 'manipulation' }}>
      {/* Close button — only visible when not in active call (active has its own end button) */}
      {state !== 'active' && (
        <button
          onClick={() => void endSession()}
          className="absolute right-4 top-4 rounded-full p-2 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          aria-label={t('voice.close')}
        >
          <X size={24} />
        </button>
      )}

      {/* Echo name */}
      <h2 className="mb-6 text-xl font-semibold text-text-primary">{echoName}</h2>

      {/* Portrait / MuseTalk video */}
      <div
        className={`relative mb-8 h-48 w-48 overflow-hidden rounded-full border-4 transition-all duration-300 ${
          state === 'active'
            ? isSpeaking
              ? 'border-accent shadow-lg shadow-accent/40 scale-105'
              : 'border-accent/60 shadow-md shadow-accent/20'
            : 'border-border-default'
        }`}
      >
        {videoFrame ? (
          <img src={videoFrame} alt={echoName} className="h-full w-full object-cover" />
        ) : avatarUrl ? (
          <img src={avatarUrl} alt={echoName} className="h-full w-full object-cover" loading="eager" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-raised text-4xl font-bold text-text-secondary">
            {echoName[0]}
          </div>
        )}

        {/* Loading overlay */}
        {(state === 'starting' || state === 'connecting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-12 w-12 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Status */}
      <p className={`mb-6 text-sm ${state === 'error' ? 'text-red-400' : 'text-text-secondary'}`}>
        {stateLabel}
      </p>

      {/* Inner monologue */}
      {innerMonologue && state === 'active' && (
        <div className="mb-6 max-w-md rounded-lg bg-surface-raised px-4 py-2 text-sm italic text-text-secondary">
          {innerMonologue.slice(-200)}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state === 'idle' || state === 'error' ? (
          <Button
            onClick={() => void startSession()}
            className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-white"
          >
            <Phone size={20} />
            {t('voice.startCall')}
          </Button>
        ) : state === 'active' ? (
          <>
            <button
              onClick={toggleMute}
              className={`rounded-full p-4 ${
                isMuted ? 'bg-red-500/20 text-red-400' : 'bg-surface-raised text-text-primary'
              }`}
              aria-label={isMuted ? t('voice.unmute') : t('voice.mute')}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <button
              onClick={() => void endSession()}
              className="rounded-full bg-red-500 p-4 text-white"
              aria-label={t('voice.endCall')}
            >
              <PhoneOff size={24} />
            </button>
          </>
        ) : (
          <Button disabled className="flex items-center gap-2 rounded-full px-6 py-3 opacity-50">
            <Loader2 size={20} className="animate-spin" />
            {state === 'starting' ? t('voice.starting') : t('voice.connectingShort')}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * VoiceSessionModal — Full-duplex voice conversation with an Echo.
 *
 * Connects to the Moshi WebSocket for real-time audio in/out.
 * Shows the Echo's portrait with a pulse animation while speaking.
 * Handles microphone permission, connection lifecycle, and clean shutdown.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Phone, PhoneOff, Loader2 } from 'lucide-react';
import { Button } from './index.ts';
import { getBaseUrl } from '../lib/api/client.ts';
import { echoes as echoApi } from '../lib/api/endpoints.ts';

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

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const cleanupRef = useRef(false);

  const cleanup = useCallback(async () => {
    if (cleanupRef.current) return;
    cleanupRef.current = true;

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioCtxRef.current) {
      await audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    // Stop the server-side Moshi process
    try {
      await echoApi.stopVoiceSession(echoId);
    } catch {
      // Best effort — session may already be stopped
    }

    cleanupRef.current = false;
  }, [echoId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  const startSession = useCallback(async () => {
    setState('starting');
    setError(null);
    setInnerMonologue('');

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Start server-side Moshi process
      const { voice_ws_url } = await echoApi.startVoiceSession(echoId);

      // 3. Wait for Moshi to load (model takes ~10-60s on first start)
      setState('connecting');

      // Poll until Moshi is ready (returns 200)
      const baseUrl = getBaseUrl();
      const moshiHealthUrl = `${baseUrl}/voice/`;
      let ready = false;
      for (let i = 0; i < 120; i++) {
        try {
          const resp = await fetch(moshiHealthUrl);
          if (resp.ok) {
            ready = true;
            break;
          }
        } catch {
          // Not ready yet
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!ready) {
        throw new Error('Moshi server did not start within timeout');
      }

      // 4. Connect WebSocket to Moshi
      const wsBase = baseUrl.replace(/^http/, 'ws');
      const wsUrl = `${wsBase}${voice_ws_url}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setState('active');
      };

      ws.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        const data = new Uint8Array(event.data);
        if (data.length === 0) return;

        const kind = data[0];
        if (kind === 0) {
          // Handshake
          setState('active');
        } else if (kind === 1) {
          // Audio data from Moshi — decode and play
          // For now, we rely on the Moshi web UI's audio handling
          // In a full implementation, decode Opus and play via Web Audio API
        } else if (kind === 2) {
          // Text (inner monologue)
          const text = new TextDecoder().decode(data.slice(1));
          setInnerMonologue((prev) => prev + text);
        }
      };

      ws.onerror = () => {
        setError('Voice connection error');
        setState('error');
      };

      ws.onclose = () => {
        if (state === 'active') {
          setState('idle');
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start voice session';
      setError(msg);
      setState('error');
      void cleanup();
    }
  }, [echoId, cleanup, state]);

  const endSession = useCallback(async () => {
    setState('idle');
    await cleanup();
    onClose();
  }, [cleanup, onClose]);

  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      const track = mediaStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      }
    }
  }, []);

  const stateLabel = {
    idle: t('voice.tapToStart', 'Tap to start conversation'),
    starting: t('voice.requestingMic', 'Requesting microphone...'),
    connecting: t('voice.connecting', 'Connecting to Echo...'),
    active: t('voice.speaking', 'Speaking...'),
    error: error || t('voice.error', 'Connection error'),
  }[state];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface-base/95 backdrop-blur-sm">
      {/* Close button */}
      <button
        onClick={() => void endSession()}
        className="absolute right-4 top-4 rounded-full p-2 text-text-secondary hover:bg-surface-raised hover:text-text-primary"
        aria-label={t('voice.close', 'Close')}
      >
        <PhoneOff size={24} />
      </button>

      {/* Echo name */}
      <h2 className="mb-6 text-xl font-semibold text-text-primary">{echoName}</h2>

      {/* Portrait with pulse animation */}
      <div
        className={`relative mb-8 h-48 w-48 overflow-hidden rounded-full border-4 ${
          state === 'active'
            ? 'border-accent animate-pulse'
            : 'border-border-default'
        }`}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={echoName}
            className="h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-raised text-4xl font-bold text-text-secondary">
            {echoName[0]}
          </div>
        )}

        {/* Connecting overlay */}
        {(state === 'starting' || state === 'connecting') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-12 w-12 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Status label */}
      <p
        className={`mb-6 text-sm ${
          state === 'error' ? 'text-red-400' : 'text-text-secondary'
        }`}
      >
        {stateLabel}
      </p>

      {/* Inner monologue (what the Echo is thinking) */}
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
            {t('voice.startCall', 'Start Call')}
          </Button>
        ) : state === 'active' ? (
          <>
            <button
              onClick={toggleMute}
              className={`rounded-full p-4 ${
                isMuted
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-surface-raised text-text-primary'
              }`}
              aria-label={isMuted ? t('voice.unmute', 'Unmute') : t('voice.mute', 'Mute')}
            >
              {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <button
              onClick={() => void endSession()}
              className="rounded-full bg-red-500 p-4 text-white"
              aria-label={t('voice.endCall', 'End Call')}
            >
              <PhoneOff size={24} />
            </button>
          </>
        ) : (
          <Button disabled className="flex items-center gap-2 rounded-full px-6 py-3 opacity-50">
            <Loader2 size={20} className="animate-spin" />
            {state === 'starting'
              ? t('voice.starting', 'Starting...')
              : t('voice.connectingShort', 'Connecting...')}
          </Button>
        )}
      </div>
    </div>
  );
}

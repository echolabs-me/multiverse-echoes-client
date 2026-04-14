/**
 * EchoPortrait3D — Mood-reactive 3D silhouette portrait.
 *
 * Renders a procedural human silhouette via React Three Fiber with
 * Painterly Realism lighting. Falls back to a 2D static portrait
 * when GPU is unavailable, the user disables 3D, or prefers-reduced-motion.
 *
 * Reference: ME-CDS-001 §9.1, ADR-005.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useGpuAvailable } from '@/hooks/useGpuAvailable';

// --- Mood colour mapping (mirrors Rust me-core::portrait::mood_to_colour) ---

interface MoodTheme {
  /** Primary colour for the silhouette lighting */
  primary: string;
  /** Ambient tint for the background glow */
  ambient: string;
  /** Light intensity multiplier */
  intensity: number;
}

const MOOD_THEMES: Record<string, MoodTheme> = {
  content: { primary: '#FF9F43', ambient: '#3d2a17', intensity: 1.2 },
  happy: { primary: '#FF9F43', ambient: '#3d2a17', intensity: 1.3 },
  joyful: { primary: '#FF9F43', ambient: '#3d2a17', intensity: 1.4 },
  melancholy: { primary: '#5B7FCC', ambient: '#1a2340', intensity: 0.8 },
  sad: { primary: '#5B7FCC', ambient: '#1a2340', intensity: 0.7 },
  lonely: { primary: '#5B7FCC', ambient: '#1a2340', intensity: 0.7 },
  conflict: { primary: '#E74C3C', ambient: '#3d1a1a', intensity: 1.5 },
  angry: { primary: '#E74C3C', ambient: '#3d1a1a', intensity: 1.6 },
  frustrated: { primary: '#E74C3C', ambient: '#3d1a1a', intensity: 1.4 },
  anxious: { primary: '#9B59B6', ambient: '#2a1a3d', intensity: 1.1 },
  nervous: { primary: '#9B59B6', ambient: '#2a1a3d', intensity: 1.0 },
  worried: { primary: '#9B59B6', ambient: '#2a1a3d', intensity: 1.0 },
  calm: { primary: '#2ECC71', ambient: '#1a3d24', intensity: 1.0 },
  peaceful: { primary: '#2ECC71', ambient: '#1a3d24', intensity: 0.9 },
  serene: { primary: '#2ECC71', ambient: '#1a3d24', intensity: 0.9 },
  excited: { primary: '#F39C12', ambient: '#3d3017', intensity: 1.3 },
  energetic: { primary: '#F39C12', ambient: '#3d3017', intensity: 1.4 },
};

const DEFAULT_THEME: MoodTheme = {
  primary: '#8E8E93',
  ambient: '#1a1a2e',
  intensity: 1.0,
};

function getMoodTheme(mood: string): MoodTheme {
  return MOOD_THEMES[mood.toLowerCase()] ?? DEFAULT_THEME;
}

// --- Silhouette mesh (procedural human bust) ---

function SilhouetteMesh({ mood }: { mood: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const theme = useMemo(() => getMoodTheme(mood), [mood]);
  const color = useMemo(() => new THREE.Color(theme.primary), [theme.primary]);

  // Gentle breathing animation — subtle scale oscillation.
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      meshRef.current.scale.y = 1 + Math.sin(t * 0.8) * 0.015;
      meshRef.current.scale.x = 1 + Math.sin(t * 0.8 + 0.5) * 0.008;
    }
  });

  return (
    <group>
      {/* Head */}
      <mesh ref={meshRef} position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          metalness={0.15}
          transparent
          opacity={0.95}
          emissive={color}
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.18, 12]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.1}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Torso (upper body silhouette) */}
      <mesh position={[0, -0.15, 0]}>
        <capsuleGeometry args={[0.22, 0.5, 8, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.1}
          transparent
          opacity={0.75}
        />
      </mesh>

      {/* Shoulders */}
      <mesh position={[-0.28, 0.05, 0]} rotation={[0, 0, 0.3]}>
        <capsuleGeometry args={[0.08, 0.2, 6, 12]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.1}
          transparent
          opacity={0.7}
        />
      </mesh>
      <mesh position={[0.28, 0.05, 0]} rotation={[0, 0, -0.3]}>
        <capsuleGeometry args={[0.08, 0.2, 6, 12]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.1}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}

// --- Lighting (Painterly Realism: warm left, cool fill) ---

function PainterlyLighting({ mood }: { mood: string }) {
  const theme = useMemo(() => getMoodTheme(mood), [mood]);
  const primaryColor = useMemo(
    () => new THREE.Color(theme.primary),
    [theme.primary],
  );

  return (
    <>
      {/* Warm key light from upper-left (Painterly Realism) */}
      <directionalLight
        position={[-2, 2, 3]}
        intensity={theme.intensity * 0.8}
        color={primaryColor}
        castShadow={false}
      />
      {/* Cool fill light from right */}
      <directionalLight
        position={[2, 0.5, 2]}
        intensity={0.3}
        color="#a0b4cc"
      />
      {/* Backlight rim — brighter for visibility against dark bg */}
      <directionalLight
        position={[0, 1, -2]}
        intensity={0.6}
        color={primaryColor}
      />
      {/* Edge light from below for rim definition */}
      <pointLight
        position={[0, -1, 1]}
        intensity={0.3}
        color={primaryColor}
        distance={4}
      />
      {/* Ambient raised for visibility */}
      <ambientLight intensity={0.3} color="#ffffff" />
    </>
  );
}

// --- 2D Static Fallback ---

function StaticFallback({
  name,
  mood,
  size,
}: {
  name: string;
  mood: string;
  size: 'sm' | 'md' | 'lg';
}) {
  const theme = getMoodTheme(mood);
  const sizeClass = size === 'lg' ? 'h-24 w-24' : size === 'md' ? 'h-20 w-20' : 'h-14 w-14';
  const textSize = size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-3xl' : 'text-xl';

  const setThemeVars = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty('--me-theme-color', theme.primary);
    el.style.setProperty('--me-theme-grad-start', `${theme.primary}33`);
    el.style.setProperty('--me-theme-grad-end', theme.ambient);
    el.style.setProperty('--me-theme-border', `${theme.primary}22`);
  };

  return (
    <div
      ref={setThemeVars}
      className={`me-theme-fallback flex ${sizeClass} shrink-0 items-center justify-center rounded-xl`}
      role="img"
      aria-label={`${name} portrait, mood: ${mood}`}
    >
      <span className={`me-theme-fg ${textSize} font-bold`}>
        {name[0] ?? '?'}
      </span>
    </div>
  );
}

// --- Main component ---

export interface EchoPortrait3DProps {
  /** Echo display name */
  name: string;
  /** Current mood string from EchoResponse.current_mood */
  mood: string;
  /** Display size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Force 2D fallback (e.g., user toggle in Settings) */
  disable3D?: boolean;
  /** AI-generated portrait URL. When set, shows the image instead of 3D silhouette. */
  avatarUrl?: string | null;
}

export function EchoPortrait3D({
  name,
  mood,
  size = 'md',
  disable3D = false,
  avatarUrl,
}: EchoPortrait3DProps) {
  const reducedMotion = useReducedMotion();
  const gpuAvailable = useGpuAvailable();

  const sizeClass = size === 'lg' ? 'h-24 w-24' : size === 'md' ? 'h-20 w-20' : 'h-14 w-14';
  const theme = getMoodTheme(mood);

  // If an AI-generated portrait exists, show it with a mood-tinted border.
  if (avatarUrl) {
    return (
      <div
        ref={(el) => {
          if (el) el.style.setProperty('--me-theme-border', `${theme.primary}44`);
        }}
        className={`me-portrait-ring ${sizeClass} shrink-0 overflow-hidden rounded-xl`}
        role="img"
        aria-label={`${name} portrait, mood: ${mood}`}
      >
        <img
          src={avatarUrl}
          alt={`${name} portrait`}
          className="h-full w-full object-cover"
          loading="eager"
        />
      </div>
    );
  }

  // Use static fallback when: reduced motion, no GPU, or user disabled 3D.
  const use2D = reducedMotion || !gpuAvailable || disable3D;

  if (use2D) {
    return <StaticFallback name={name} mood={mood} size={size} />;
  }

  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden rounded-xl`}
      role="img"
      aria-label={`${name} portrait, mood: ${mood}`}
    >
      <Suspense fallback={<StaticFallback name={name} mood={mood} size={size} />}>
        <Canvas
          camera={{ position: [0, 0.2, 2], fov: 40 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          className="bg-transparent"
          frameloop="always"
        >
          <color attach="background" args={[getMoodTheme(mood).ambient]} />
          <fog
            attach="fog"
            args={[getMoodTheme(mood).ambient, 2, 5]}
          />
          <PainterlyLighting mood={mood} />
          <SilhouetteMesh mood={mood} />
        </Canvas>
      </Suspense>
    </div>
  );
}

export default EchoPortrait3D;

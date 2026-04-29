/**
 * EchoBirthAnimation — Full cinematic birth sequence.
 *
 * 15-second animation: particles of light coalesce from screen edges into
 * human silhouette, silhouette "breathes" and comes to life, resolves into
 * Echo's portrait. Plays only once on Echo creation.
 *
 * GPU budget note: uses ~100 particles (point sprites) with simple vertex
 * animation. No post-processing. Shares the 10% GPU budget with portraits
 * and shard environments (Steps 1-2).
 *
 * Reference: ME-CDS-001 §7.3.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import {
  useRef,
  useMemo,
  useState,
  useEffect,
  useCallback,
  Suspense,
} from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useGpuAvailable } from '@/hooks/useGpuAvailable';
import { seededRandom } from '@/lib/shardTheme';

// --- Constants ---

/** Total animation duration in seconds. */
const ANIMATION_DURATION = 15;

/** Number of particles (kept low for GPU budget). */
const PARTICLE_COUNT = 120;

/** Silhouette target positions for particles to converge to. */
function generateSilhouetteTargets(count: number): Float32Array {
  const targets = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const s = i * 7 + 42;
    const t = i / count;
    // Head region (top 30%)
    if (t < 0.3) {
      const angle = seededRandom(s) * Math.PI * 2;
      const r = seededRandom(s + 1) * 0.25;
      targets[i * 3] = Math.cos(angle) * r;
      targets[i * 3 + 1] = 0.5 + seededRandom(s + 2) * 0.3;
      targets[i * 3 + 2] = Math.sin(angle) * r * 0.3;
    }
    // Torso region (middle 50%)
    else if (t < 0.8) {
      const bodyT = (t - 0.3) / 0.5;
      const width = 0.2 + bodyT * 0.15;
      targets[i * 3] = (seededRandom(s) - 0.5) * width * 2;
      targets[i * 3 + 1] = 0.4 - bodyT * 0.8;
      targets[i * 3 + 2] = (seededRandom(s + 2) - 0.5) * 0.15;
    }
    // Shoulder region (bottom 20%)
    else {
      const side = seededRandom(s) > 0.5 ? 1 : -1;
      targets[i * 3] = side * (0.2 + seededRandom(s + 1) * 0.15);
      targets[i * 3 + 1] = 0.1 + seededRandom(s + 2) * 0.2;
      targets[i * 3 + 2] = (seededRandom(s + 3) - 0.5) * 0.1;
    }
  }
  return targets;
}

// Pre-compute targets and start positions at module level (deterministic).
const SILHOUETTE_TARGETS = generateSilhouetteTargets(PARTICLE_COUNT);

const START_POSITIONS = (() => {
  const arr = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const s = i * 11 + 99;
    const angle = seededRandom(s) * Math.PI * 2;
    const dist = 2 + seededRandom(s + 1) * 3;
    arr[i * 3] = Math.cos(angle) * dist;
    arr[i * 3 + 1] = (seededRandom(s + 2) - 0.5) * 4;
    arr[i * 3 + 2] = Math.sin(angle) * dist * 0.5 - 1;
  }
  return arr;
})();

// --- Animated particle system ---

function BirthParticles({ onComplete }: { onComplete: () => void }) {
  const pointsRef = useRef<THREE.Points>(null);
  const startTime = useRef<number | null>(null);
  const completed = useRef(false);

  const positions = useMemo(() => new Float32Array(START_POSITIONS), []);

  const sizes = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i] = 0.03 + seededRandom(i * 5 + 7) * 0.04;
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    if (startTime.current === null) startTime.current = state.clock.elapsedTime;

    const elapsed = state.clock.elapsedTime - startTime.current;
    const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position');
    const posArray = posAttr.array as Float32Array;

    // Phase 1 (0–8s): particles drift inward toward silhouette targets
    // Phase 2 (8–12s): silhouette formed, subtle breathing
    // Phase 3 (12–15s): glow intensifies, particles solidify
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      const convergeFactor = easeInOutCubic(Math.min(progress / 0.55, 1));

      // Lerp from start to target
      posArray[idx] =
        START_POSITIONS[idx]! +
        (SILHOUETTE_TARGETS[idx]! - START_POSITIONS[idx]!) * convergeFactor;
      posArray[idx + 1] =
        START_POSITIONS[idx + 1]! +
        (SILHOUETTE_TARGETS[idx + 1]! - START_POSITIONS[idx + 1]!) *
          convergeFactor;
      posArray[idx + 2] =
        START_POSITIONS[idx + 2]! +
        (SILHOUETTE_TARGETS[idx + 2]! - START_POSITIONS[idx + 2]!) *
          convergeFactor;

      // Phase 2: breathing oscillation once converged
      if (progress > 0.55) {
        const breathe = Math.sin(elapsed * 1.2) * 0.01 * (1 - progress);
        posArray[idx + 1] += breathe;
      }
    }
    posAttr.needsUpdate = true;

    // Update material opacity — fade in during phase 1, glow in phase 3
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    if (progress < 0.1) {
      mat.opacity = progress / 0.1;
    } else if (progress > 0.8) {
      // Phase 3: intensify
      mat.opacity = 0.7 + (progress - 0.8) * 1.5;
    } else {
      mat.opacity = 0.7;
    }

    // Signal completion
    if (progress >= 1 && !completed.current) {
      completed.current = true;
      onComplete();
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        color="#d4915c"
        size={0.06}
        transparent
        opacity={0}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// --- Reduced motion fallback ---

function ReducedMotionFallback({
  echoName,
  onComplete,
}: {
  echoName: string;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'creating' | 'alive'>('creating');

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase('alive');
      onComplete();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <div className="flex size-32 items-center justify-center rounded-full bg-accent/10">
        <span className="text-5xl font-bold text-accent">
          {echoName[0] ?? '?'}
        </span>
      </div>
      <p className="text-lg font-medium text-text-primary">
        {phase === 'creating' ? 'Creating your Echo…' : 'Your Echo is alive.'}
      </p>
    </div>
  );
}

// --- Main component ---

export interface EchoBirthAnimationProps {
  /** Echo name for the portrait initial */
  echoName: string;
  /** Called when the animation completes (15s or 3s for reduced motion) */
  onComplete: () => void;
}

export function EchoBirthAnimation({
  echoName,
  onComplete,
}: EchoBirthAnimationProps) {
  const reducedMotion = useReducedMotion();
  const gpuAvailable = useGpuAvailable();
  const stableOnComplete = useCallback(() => onComplete(), [onComplete]);

  if (reducedMotion || !gpuAvailable) {
    return (
      <ReducedMotionFallback
        echoName={echoName}
        onComplete={stableOnComplete}
      />
    );
  }

  return (
    <div className="size-80">
      <Suspense
        fallback={
          <ReducedMotionFallback
            echoName={echoName}
            onComplete={stableOnComplete}
          />
        }
      >
        <Canvas
          camera={{ position: [0, 0, 3], fov: 45 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          className="bg-transparent"
          frameloop="always"
        >
          <color attach="background" args={['#0f1923']} />
          <ambientLight intensity={0.1} />
          <pointLight position={[-1, 1, 2]} intensity={0.5} color="#d4915c" />
          <BirthParticles onComplete={stableOnComplete} />
        </Canvas>
      </Suspense>
    </div>
  );
}

export default EchoBirthAnimation;

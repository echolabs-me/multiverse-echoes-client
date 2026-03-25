/**
 * ShardEnvironment3D — Atmospheric 3D backdrop for Shard views.
 *
 * Four themed environments rendered behind the Dashboard UI.
 * Purely ambient — not interactive. Behind UI layer with depth separation.
 * Each environment < 5 MB assets. Baked lighting, simple geometry, particles.
 *
 * Reference: ME-CDS-001 §9.2.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useGpuAvailable } from '@/hooks/useGpuAvailable';
import {
  shardNameToTheme,
  seededRandom,
  type ShardTheme,
} from '@/lib/shardTheme';

// --- Theme configurations ---

interface ThemeConfig {
  bgColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientColor: string;
  ambientIntensity: number;
  keyLightColor: string;
  keyLightIntensity: number;
  particleColor: string;
  particleCount: number;
}

const THEME_CONFIGS: Record<ShardTheme, ThemeConfig> = {
  'cyber-tokyo': {
    bgColor: '#070b14',
    fogColor: '#0a0e1a',
    fogNear: 3,
    fogFar: 12,
    ambientColor: '#001830',
    ambientIntensity: 0.15,
    keyLightColor: '#00d4ff',
    keyLightIntensity: 0.6,
    particleColor: '#00d4ff',
    particleCount: 80,
  },
  'nomad-australia': {
    bgColor: '#1a0e06',
    fogColor: '#2a1a0e',
    fogNear: 4,
    fogFar: 15,
    ambientColor: '#3d2a17',
    ambientIntensity: 0.25,
    keyLightColor: '#ff8c42',
    keyLightIntensity: 0.8,
    particleColor: '#c4783c',
    particleCount: 40,
  },
  'renaissance-florence': {
    bgColor: '#1a1408',
    fogColor: '#2a2010',
    fogNear: 3,
    fogFar: 14,
    ambientColor: '#3d3017',
    ambientIntensity: 0.2,
    keyLightColor: '#ffb347',
    keyLightIntensity: 0.7,
    particleColor: '#8b6f47',
    particleCount: 30,
  },
  personal: {
    bgColor: '#0f1923',
    fogColor: '#1a2633',
    fogNear: 5,
    fogFar: 18,
    ambientColor: '#1a2633',
    ambientIntensity: 0.2,
    keyLightColor: '#d4915c',
    keyLightIntensity: 0.5,
    particleColor: '#d4915c',
    particleCount: 50,
  },
  default: {
    bgColor: '#0f1923',
    fogColor: '#1a2633',
    fogNear: 5,
    fogFar: 18,
    ambientColor: '#1a2633',
    ambientIntensity: 0.2,
    keyLightColor: '#d4915c',
    keyLightIntensity: 0.5,
    particleColor: '#d4915c',
    particleCount: 50,
  },
};

// --- Pre-computed building layouts (deterministic, no Math.random in render) ---

interface BuildingData {
  x: number;
  h: number;
  z: number;
  w: number;
}

function generateBuildings(
  count: number,
  seedBase: number,
  xSpread: number,
  xOffset: number,
  hMin: number,
  hRange: number,
  zMin: number,
  zRange: number,
  wMin: number,
  wRange: number,
): BuildingData[] {
  const buildings: BuildingData[] = [];
  for (let i = 0; i < count; i++) {
    const s = seedBase + i * 7;
    buildings.push({
      x: (i - count / 2) * xSpread + seededRandom(s) * 0.5 + xOffset,
      h: hMin + seededRandom(s + 1) * hRange,
      z: zMin - seededRandom(s + 2) * zRange,
      w: wMin + seededRandom(s + 3) * wRange,
    });
  }
  return buildings;
}

const CYBER_BUILDINGS = generateBuildings(12, 100, 1.2, 0, 1, 3, -4, 4, 0.4, 0.3);
const FLORENCE_BUILDINGS = generateBuildings(6, 200, 2, 0, 1.5, 1.5, -5, 3, 0.8, 0.5);

// --- Particle field (floating atmospheric particles) ---

function ParticleField({
  count,
  color,
  seed,
}: {
  count: number;
  color: string;
  seed: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const s = seed + i * 3;
      arr[i * 3] = (seededRandom(s) - 0.5) * 12;
      arr[i * 3 + 1] = (seededRandom(s + 1) - 0.5) * 8;
      arr[i * 3 + 2] = (seededRandom(s + 2) - 0.5) * 8 - 2;
    }
    return arr;
  }, [count, seed]);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.01;
      pointsRef.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.008) * 0.05;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.04}
        transparent
        opacity={0.5}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// --- Cyber-Tokyo 2045: Neon cityscape ---

function CyberTokyoEnvironment() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y =
        Math.sin(state.clock.elapsedTime * 0.02) * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Distant buildings — simple boxes with pre-computed positions */}
      {CYBER_BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2 - 1, b.z]}>
          <boxGeometry args={[b.w, b.h, 0.4]} />
          <meshStandardMaterial
            color="#0a1428"
            emissive="#001830"
            emissiveIntensity={0.3}
            transparent
            opacity={0.6}
          />
        </mesh>
      ))}
      {/* Neon accent lines */}
      <mesh position={[0, -1, -3]}>
        <planeGeometry args={[14, 0.01]} />
        <meshStandardMaterial
          color="#00d4ff"
          emissive="#00d4ff"
          emissiveIntensity={1}
          transparent
          opacity={0.3}
        />
      </mesh>
      <ParticleField count={80} color="#00d4ff" seed={300} />
    </group>
  );
}

// --- Nomad Australia 2030: Vast outback ---

function NomadAustraliaEnvironment() {
  return (
    <group>
      {/* Ground plane — sun-scorched earth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, -2]}>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.95} />
      </mesh>
      {/* Distant horizon ridge */}
      <mesh position={[0, -0.5, -8]}>
        <boxGeometry args={[20, 0.5, 0.3]} />
        <meshStandardMaterial
          color="#6b4423"
          transparent
          opacity={0.5}
        />
      </mesh>
      {/* Heat shimmer particles (dust) */}
      <ParticleField count={40} color="#c4783c" seed={400} />
    </group>
  );
}

// --- Renaissance Florence 1490: Golden-hour stone ---

function RenaissanceEnvironment() {
  return (
    <group>
      {/* Stone buildings in distance with pre-computed positions */}
      {FLORENCE_BUILDINGS.map((b, i) => (
        <mesh key={i} position={[b.x, b.h / 2 - 1.2, b.z]}>
          <boxGeometry args={[b.w, b.h, 0.6]} />
          <meshStandardMaterial
            color="#8b7355"
            roughness={0.9}
            transparent
            opacity={0.5}
          />
        </mesh>
      ))}
      {/* River reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, -4]}>
        <planeGeometry args={[4, 8]} />
        <meshStandardMaterial
          color="#4a6741"
          roughness={0.3}
          metalness={0.4}
          transparent
          opacity={0.3}
        />
      </mesh>
      {/* Warm fog particles */}
      <ParticleField count={30} color="#8b6f47" seed={500} />
    </group>
  );
}

// --- Personal Shard: Abstract warm gradient ---

function PersonalEnvironment() {
  return (
    <group>
      {/* Floating warm particles in abstract space */}
      <ParticleField count={50} color="#d4915c" seed={600} />
      {/* Subtle ground glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <circleGeometry args={[4, 32]} />
        <meshStandardMaterial
          color="#1a2633"
          emissive="#d4915c"
          emissiveIntensity={0.05}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}

// --- Environment selector ---

function EnvironmentScene({ theme }: { theme: ShardTheme }) {
  const config = THEME_CONFIGS[theme];

  return (
    <>
      <color attach="background" args={[config.bgColor]} />
      <fog
        attach="fog"
        args={[config.fogColor, config.fogNear, config.fogFar]}
      />
      <ambientLight
        intensity={config.ambientIntensity}
        color={config.ambientColor}
      />
      <directionalLight
        position={[-3, 3, 5]}
        intensity={config.keyLightIntensity}
        color={config.keyLightColor}
      />
      {theme === 'cyber-tokyo' && <CyberTokyoEnvironment />}
      {theme === 'nomad-australia' && <NomadAustraliaEnvironment />}
      {theme === 'renaissance-florence' && <RenaissanceEnvironment />}
      {(theme === 'personal' || theme === 'default') && (
        <PersonalEnvironment />
      )}
    </>
  );
}

// --- 2D Static fallback (gradient background) ---

function StaticFallback({ theme }: { theme: ShardTheme }) {
  const config = THEME_CONFIGS[theme];
  return (
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(180deg, ${config.bgColor} 0%, ${config.fogColor} 100%)`,
      }}
      aria-hidden="true"
    />
  );
}

// --- Main component ---

export interface ShardEnvironment3DProps {
  /** Shard name or theme identifier */
  shardName: string;
  /** Force disable 3D (user toggle in Settings) */
  disable3D?: boolean;
}

export function ShardEnvironment3D({
  shardName,
  disable3D = false,
}: ShardEnvironment3DProps) {
  const reducedMotion = useReducedMotion();
  const gpuAvailable = useGpuAvailable();
  const theme = useMemo(() => shardNameToTheme(shardName), [shardName]);

  const use2D = reducedMotion || !gpuAvailable || disable3D;

  if (use2D) {
    return <StaticFallback theme={theme} />;
  }

  return (
    <div className="absolute inset-0 -z-10" aria-hidden="true">
      <Suspense fallback={<StaticFallback theme={theme} />}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{ antialias: false, alpha: false }}
          frameloop="always"
          style={{ pointerEvents: 'none' }}
        >
          <EnvironmentScene theme={theme} />
        </Canvas>
      </Suspense>
    </div>
  );
}

export default ShardEnvironment3D;

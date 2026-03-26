import { useEffect, useRef } from 'react';
import type { MoodPalette } from '../hooks/useMoodAtmosphere.ts';

/**
 * Lightweight canvas particle system — Phase 6B Step 11
 *
 * 15-25 ambient particles that drift based on the mood palette.
 * Respects prefers-reduced-motion (hidden when reduced motion is preferred).
 * Canvas is positioned absolutely behind content.
 */

const PARTICLE_COUNT = 20;

interface Particle {
  x: number;
  y: number;
  size: number;
  opacity: number;
  vx: number;
  vy: number;
  /** Base angle for erratic oscillation */
  phase: number;
}

function createParticles(width: number, height: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 1.5 + Math.random() * 2.5,
    opacity: 0.15 + Math.random() * 0.25,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    phase: Math.random() * Math.PI * 2,
  }));
}

function updateParticle(
  p: Particle,
  width: number,
  height: number,
  speed: number,
  direction: MoodPalette['particleDirection'],
  time: number,
) {
  switch (direction) {
    case 'float':
      // Gentle upward-biased float with slight horizontal sway
      p.x += Math.sin(time * 0.001 + p.phase) * 0.15 * speed;
      p.y -= 0.1 * speed + Math.sin(time * 0.0008 + p.phase) * 0.05;
      break;
    case 'drift-down':
      // Slow downward drift like falling motes
      p.x += Math.sin(time * 0.0006 + p.phase) * 0.2 * speed;
      p.y += 0.15 * speed;
      break;
    case 'erratic':
      // Tighter, jittery movement
      p.x += Math.sin(time * 0.003 + p.phase) * 0.4 * speed;
      p.y += Math.cos(time * 0.0025 + p.phase * 1.3) * 0.35 * speed;
      break;
    case 'energetic':
      // Faster, wider movements
      p.x += p.vx * speed * 1.5 + Math.sin(time * 0.002 + p.phase) * 0.2;
      p.y += p.vy * speed * 1.5 + Math.cos(time * 0.0015 + p.phase) * 0.15;
      break;
  }

  // Wrap around edges
  if (p.x < -10) p.x = width + 10;
  if (p.x > width + 10) p.x = -10;
  if (p.y < -10) p.y = height + 10;
  if (p.y > height + 10) p.y = -10;
}

interface MoodParticlesProps {
  palette: MoodPalette;
  className?: string;
}

export function MoodParticles({ palette, className = '' }: MoodParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion.current = mql.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      if (particlesRef.current.length === 0) {
        particlesRef.current = createParticles(canvas.width, canvas.height);
      }
    };
    resize();

    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    let lastPalette = palette;

    const animate = (time: number) => {
      if (prefersReducedMotion.current) {
        // Draw particles once, static — no animation loop
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particlesRef.current) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = lastPalette.primary;
          ctx.globalAlpha = p.opacity * 0.5;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return; // Don't request another frame
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particlesRef.current) {
        updateParticle(
          p,
          canvas.width,
          canvas.height,
          lastPalette.particleSpeed,
          lastPalette.particleDirection,
          time,
        );

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = lastPalette.primary;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // Update palette ref for the animation loop
    lastPalette = palette;

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      observer.disconnect();
    };
  }, [palette]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden="true"
    />
  );
}

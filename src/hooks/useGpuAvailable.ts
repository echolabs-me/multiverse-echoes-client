/**
 * WebGL availability probe.
 *
 * Computed ONCE at module load and cached — WebGL availability does not
 * change during a page's lifetime. Calling this on every render would
 * allocate a fresh WebGL context per call (the browser caps these at ~16
 * per page), and garbage collection of the probe canvas does not release
 * the context deterministically. That was the root cause of the
 * "too many active WebGL contexts" warnings observed in production.
 *
 * After probing, the single probe context is immediately released via the
 * WEBGL_lose_context extension so it doesn't count toward the cap either.
 */

const gpuAvailable: boolean = (() => {
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null);

    if (gl === null) return false;

    // Release the probe context so it doesn't occupy a slot in the
    // browser's per-page WebGL context pool.
    const loseContext = gl.getExtension('WEBGL_lose_context') as {
      loseContext: () => void;
    } | null;
    loseContext?.loseContext();

    return true;
  } catch {
    return false;
  }
})();

/**
 * Returns whether WebGL is available for 3D rendering.
 * The result is cached at module load — safe to call on every render.
 *
 * Named `useGpuAvailable` for historical call-site compatibility; it is a
 * plain function, not a React hook, and does not depend on any hook rules.
 */
export function useGpuAvailable(): boolean {
  return gpuAvailable;
}

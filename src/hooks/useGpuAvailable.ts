/**
 * Detects whether WebGL is available for 3D rendering.
 * Returns false on devices without GPU / with WebGL disabled.
 */
export function useGpuAvailable(): boolean {
  // Compute once on first call — no effect needed since WebGL availability
  // doesn't change during the lifetime of a page.
  try {
    if (typeof document === 'undefined') return false;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return gl !== null;
  } catch {
    return false;
  }
}

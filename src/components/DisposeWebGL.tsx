/**
 * DisposeWebGL — Force-release the WebGL context when a Canvas unmounts.
 *
 * React Three Fiber disposes scene resources on unmount, but on some browsers
 * (notably Safari/iPad) the underlying WebGL context is kept alive and
 * eventually triggers the browser "too many active WebGL contexts" warning.
 *
 * Mount this as a child of any `<Canvas>` to guarantee the context is
 * released. It uses `useThree` to grab the renderer, then calls
 * `renderer.dispose()` and `renderer.forceContextLoss()` in the cleanup
 * phase of the effect — which fires when the surrounding Canvas unmounts.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export function DisposeWebGL() {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    return () => {
      try {
        gl.dispose();
        // Skip forceContextLoss if the underlying context is already gone
        // (browser reclaimed it, or it was lost via a prior dispose path).
        // Calling loseContext twice emits a
        //   WebGL: INVALID_OPERATION: loseContext: context already lost
        // warning without any benefit — the context is already released.
        const raw = gl.getContext();
        if (!raw.isContextLost()) {
          gl.forceContextLoss();
        }
      } catch {
        // Renderer may already be disposed; nothing to clean up.
      }
    };
  }, [gl]);

  return null;
}

export default DisposeWebGL;

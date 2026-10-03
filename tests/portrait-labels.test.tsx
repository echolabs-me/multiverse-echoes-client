import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../src/i18n.ts';
import { getMoodLabel } from '../src/lib/moodLabel.ts';
import { EchoPortrait3D } from '../src/components/EchoPortrait3D.tsx';

/**
 * R284.5: every path of the portrait takes its label from one key. The GPU
 * check and the three.js canvas are stood in for, so the 3D path renders
 * under happy-dom, which has no WebGL.
 */

vi.mock('@/hooks/useGpuAvailable', () => ({ useGpuAvailable: () => true }));
vi.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));
vi.mock('@react-three/fiber', () => ({
  Canvas: () => null,
  useFrame: () => undefined,
}));

const saved: [string, string][] = [];
function overrideText(key: string, value: string) {
  saved.push([key, i18n.t(key)]);
  i18n.addResource('en', 'translation', key, value);
}
afterEach(() => {
  for (const [key, value] of saved.splice(0)) {
    i18n.addResource('en', 'translation', key, value);
  }
});

describe('the portrait labels itself from its keys (R284.5)', () => {
  it('the 3D path', () => {
    overrideText('echo.portraitLabel', '{{name}}, feeling {{mood}}');
    render(<EchoPortrait3D name="Akira" mood="melancholy" />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      `Akira, feeling ${getMoodLabel('melancholy')}`,
    );
  });

  it('the image path, and its alt text', () => {
    overrideText('echo.portraitLabel', '{{name}}, feeling {{mood}}');
    overrideText('echo.portraitAlt', 'Picture of {{name}}');
    render(
      <EchoPortrait3D
        name="Akira"
        mood="melancholy"
        avatarUrl="data:image/png;base64,iVBORw0KGgo="
      />,
    );
    const [frame] = screen.getAllByRole('img');
    expect(frame).toHaveAttribute(
      'aria-label',
      `Akira, feeling ${getMoodLabel('melancholy')}`,
    );
    expect(screen.getByAltText('Picture of Akira')).toBeInTheDocument();
  });
});

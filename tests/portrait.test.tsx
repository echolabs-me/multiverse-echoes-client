import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../src/i18n.ts';
import { getMoodLabel } from '../src/lib/moodLabel.ts';
import { EchoPortrait3D } from '../src/components/EchoPortrait3D.tsx';

// R284.5: the portrait's label is one key whose text holds the name and the
// mood. The test gives the key other text, so a label built in code fails.
const KEY = 'echo.portraitLabel';
const saved = i18n.t(KEY);
afterEach(() => {
  i18n.addResource('en', 'translation', KEY, saved);
});

// happy-dom has no WebGL, so useGpuAvailable returns false → all renders use 2D fallback.
// This is intentional: we test the fallback path in unit tests, 3D in E2E.

describe('EchoPortrait3D', () => {
  it('renders static fallback with echo initial', () => {
    render(<EchoPortrait3D name="Sakura" mood="content" />);
    // 2D fallback shows the first letter.
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it("has accessible role and label, from its key, with the mood's label", () => {
    i18n.addResource('en', 'translation', KEY, '{{name}}, feeling {{mood}}');
    render(<EchoPortrait3D name="Akira" mood="melancholy" />);
    const portrait = screen.getByRole('img');
    expect(portrait).toHaveAttribute(
      'aria-label',
      `Akira, feeling ${getMoodLabel('melancholy')}`,
    );
  });

  it('renders fallback when disable3D is true', () => {
    render(<EchoPortrait3D name="Echo" mood="calm" disable3D />);
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('applies mood colour to fallback', () => {
    const { container } = render(
      <EchoPortrait3D name="Test" mood="conflict" />,
    );
    const portrait = container.querySelector('[role="img"]');
    expect(portrait).toBeTruthy();
    // The conflict mood uses red (#E74C3C) in the gradient.
    const style = portrait?.getAttribute('style') ?? '';
    expect(style).toContain('#E74C3C');
  });

  it('updates when mood changes', () => {
    const { rerender, container } = render(
      <EchoPortrait3D name="Test" mood="content" />,
    );
    let style =
      container.querySelector('[role="img"]')?.getAttribute('style') ?? '';
    expect(style).toContain('#FF9F43'); // warm amber

    rerender(<EchoPortrait3D name="Test" mood="melancholy" />);
    style =
      container.querySelector('[role="img"]')?.getAttribute('style') ?? '';
    expect(style).toContain('#5B7FCC'); // cool blue
  });

  it('renders at different sizes', () => {
    const { rerender, container } = render(
      <EchoPortrait3D name="A" mood="calm" size="sm" />,
    );
    let portrait = container.querySelector('[role="img"]');
    expect(portrait?.className).toContain('h-14');

    rerender(<EchoPortrait3D name="A" mood="calm" size="lg" />);
    portrait = container.querySelector('[role="img"]');
    expect(portrait?.className).toContain('h-24');
  });

  it('falls back to neutral grey for unknown moods', () => {
    const { container } = render(
      <EchoPortrait3D name="X" mood="unknown_mood_xyz" />,
    );
    const style =
      container.querySelector('[role="img"]')?.getAttribute('style') ?? '';
    expect(style).toContain('#8E8E93'); // neutral grey
  });
});

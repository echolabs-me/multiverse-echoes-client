import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EchoPortrait3D } from '../src/components/EchoPortrait3D.tsx';

// happy-dom has no WebGL, so useGpuAvailable returns false → all renders use 2D fallback.
// This is intentional: we test the fallback path in unit tests, 3D in E2E.

describe('EchoPortrait3D', () => {
  it('renders static fallback with echo initial', () => {
    render(<EchoPortrait3D name="Sakura" mood="content" />);
    // 2D fallback shows the first letter.
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('has accessible role and label', () => {
    render(<EchoPortrait3D name="Akira" mood="melancholy" />);
    const portrait = screen.getByRole('img');
    expect(portrait).toHaveAttribute(
      'aria-label',
      'Akira portrait, mood: melancholy',
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

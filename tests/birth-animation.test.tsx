import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { EchoBirthAnimation } from '../src/components/EchoBirthAnimation.tsx';

// happy-dom has no WebGL → reduced motion fallback renders in all cases.

describe('EchoBirthAnimation', () => {
  it('renders reduced-motion fallback with echo initial', () => {
    const onComplete = vi.fn();
    render(<EchoBirthAnimation echoName="Sakura" onComplete={onComplete} />);
    // Fallback shows first letter.
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('shows "Creating your Echo…" text initially', () => {
    const onComplete = vi.fn();
    render(<EchoBirthAnimation echoName="Test" onComplete={onComplete} />);
    expect(screen.getByText('Creating your Echo…')).toBeInTheDocument();
  });

  it('calls onComplete after fallback delay', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<EchoBirthAnimation echoName="Test" onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();

    // Advance past the 3-second reduced-motion delay.
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('transitions to "alive" text after delay', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<EchoBirthAnimation echoName="Echo" onComplete={onComplete} />);

    await act(async () => {
      vi.advanceTimersByTime(3100);
    });

    expect(screen.getByText('Your Echo is alive.')).toBeInTheDocument();
    vi.useRealTimers();
  });
});

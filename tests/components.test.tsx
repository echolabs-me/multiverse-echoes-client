import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SkipLink,
  Spinner,
  Tabs,
  Tooltip,
} from '../src/components/index.ts';

// Minimal i18n for tests
const testI18n = i18n.createInstance();
void testI18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        'common.loading': 'Loading...',
        'common.skipToContent': 'Skip to main content',
      },
    },
  },
  lng: 'en',
  interpolation: { escapeValue: false },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>;
}

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { container } = render(<Button variant="danger">Delete</Button>);
    expect(container.firstChild).toHaveClass('bg-danger');
  });

  it('disables when disabled prop set', () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick handler', () => {
    const handler = vi.fn();
    render(<Button onClick={handler}>Press</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies compact variant padding', () => {
    const { container } = render(<Card variant="compact">Compact</Card>);
    expect(container.firstChild).toHaveClass('p-4');
  });

  it('applies spacious variant padding', () => {
    const { container } = render(<Card variant="spacious">Spacious</Card>);
    expect(container.firstChild).toHaveClass('p-8');
  });
});

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('sets aria-invalid when error present', () => {
    render(<Input label="Email" error="Invalid" />);
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('renders textarea when multiline', () => {
    render(<Input label="Bio" multiline />);
    expect(screen.getByLabelText('Bio').tagName).toBe('TEXTAREA');
  });
});

describe('Badge', () => {
  it('renders with text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('applies variant classes', () => {
    const { container } = render(<Badge variant="success">Done</Badge>);
    expect(container.firstChild).toHaveClass('text-success');
  });
});

describe('Avatar', () => {
  it('renders image when src provided', () => {
    render(<Avatar src="/img.jpg" alt="User" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/img.jpg');
  });

  it('renders initials when no src', () => {
    render(<Avatar alt="John Doe" />);
    expect(screen.getByLabelText('John Doe')).toHaveTextContent('JD');
  });

  it('uses single initial for single name', () => {
    render(<Avatar alt="Alice" />);
    expect(screen.getByLabelText('Alice')).toHaveTextContent('A');
  });
});

describe('Spinner', () => {
  it('has accessible loading text', () => {
    render(<Spinner />, { wrapper: Wrapper });
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState title="No items" description="Nothing here yet" />,
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(
      <EmptyState title="Empty" action={<button>Add</button>} />,
    );
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('SkipLink', () => {
  it('renders with correct href', () => {
    render(<SkipLink />, { wrapper: Wrapper });
    const link = screen.getByText('Skip to main content');
    expect(link).toHaveAttribute('href', '#main-content');
  });
});

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Tab A', content: <div>Content A</div> },
    { id: 'b', label: 'Tab B', content: <div>Content B</div> },
  ];

  it('renders all tab buttons', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByRole('tab', { name: 'Tab A' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab B' })).toBeInTheDocument();
  });

  it('shows first tab content by default', () => {
    render(<Tabs tabs={tabs} />);
    expect(screen.getByText('Content A')).toBeInTheDocument();
  });

  it('switches tab on click', () => {
    render(<Tabs tabs={tabs} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }));
    expect(screen.getByText('Content B')).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    render(<Tabs tabs={tabs} />);
    const tabA = screen.getByRole('tab', { name: 'Tab A' });
    expect(tabA).toHaveAttribute('aria-selected', 'true');
    expect(tabA).toHaveAttribute('aria-controls', 'panel-a');
  });

  it('navigates with arrow keys', () => {
    render(<Tabs tabs={tabs} />);
    const tabA = screen.getByRole('tab', { name: 'Tab A' });
    fireEvent.keyDown(tabA, { key: 'ArrowRight' });
    expect(screen.getByText('Content B')).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  it('shows tooltip on hover', async () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Help text" delay={0}>
        <button>Hover me</button>
      </Tooltip>,
    );

    // The outer wrapper div handles mouseEnter
    const wrapper = screen.getByText('Hover me').closest('.relative');
    await act(async () => {
      fireEvent.mouseEnter(wrapper!);
      vi.advanceTimersByTime(10);
    });

    expect(screen.getByText('Help text')).toBeInTheDocument();
    vi.useRealTimers();
  });
});

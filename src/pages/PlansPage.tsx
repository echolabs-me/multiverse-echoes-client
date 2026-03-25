import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check } from 'lucide-react';
import { Card, Badge } from '../components/index.ts';

const TIERS = [
  {
    name: 'Free',
    price: 'Free',
    current: true,
    features: [
      '1 Echo',
      '1 conversation/day (10 messages)',
      'Personal Shard',
      'Basic diary & timeline',
    ],
  },
  {
    name: 'Core',
    price: 'Coming soon',
    current: false,
    features: [
      '3 Echoes',
      '5 conversations/day (20 messages)',
      'Access to public Shards',
      '5 influence points/day',
      '2 API keys',
    ],
  },
  {
    name: 'Creator',
    price: 'Coming soon',
    current: false,
    features: [
      '10 Echoes',
      '20 conversations/day (50 messages)',
      'Create custom Shards',
      '20 influence points/day',
      '10 API keys',
      'Story export (video)',
    ],
  },
  {
    name: 'God Mode',
    price: 'Coming soon',
    current: false,
    features: [
      '50 Echoes',
      'Unlimited conversations',
      'All Creator features',
      'Unlimited influence',
      'Priority LLM inference',
      'Early access to new features',
    ],
  },
];

export function PlansPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="mx-auto w-full max-w-4xl p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <h1 className="mb-2 text-2xl font-bold text-text-primary">Plans</h1>
        <p className="mb-8 text-sm text-text-secondary">
          Choose the right plan for your multiverse. Payment integration is coming soon.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => (
            <Card key={tier.name} className={tier.current ? 'border-accent' : ''}>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-text-primary">{tier.name}</h3>
                  {tier.current && <Badge variant="success">Current</Badge>}
                </div>
                <p className="text-xl font-semibold text-accent">{tier.price}</p>
                <ul className="flex flex-col gap-1.5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-text-secondary">
                      <Check size={14} className="mt-0.5 shrink-0 text-success" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-border bg-surface p-4 text-center">
          <p className="text-sm text-text-muted">
            Payment integration is coming in a future update. Your Free tier access
            includes everything you need to get started.
          </p>
        </div>
      </div>
    </div>
  );
}

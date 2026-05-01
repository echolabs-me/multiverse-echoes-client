import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Heart, Sparkles } from 'lucide-react';
import { Button, Card } from '../components/index.ts';
import { trackEvent } from '../lib/analytics.ts';
import type { ReactNode } from 'react';

interface ExpectationCard {
  titleKey: string;
  bodyKey: string;
  icon: ReactNode;
}

const cards: ExpectationCard[] = [
  {
    titleKey: 'onboarding.card1Title',
    bodyKey: 'onboarding.card1Body',
    icon: <Eye size={32} className="text-accent" />,
  },
  {
    titleKey: 'onboarding.card2Title',
    bodyKey: 'onboarding.card2Body',
    icon: <Heart size={32} className="text-accent" />,
  },
  {
    titleKey: 'onboarding.card3Title',
    bodyKey: 'onboarding.card3Body',
    icon: <Sparkles size={32} className="text-accent" />,
  },
];

export function OnboardingWelcomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentCard, setCurrentCard] = useState(0);

  const isLastCard = currentCard === cards.length - 1;

  function handleNext() {
    trackEvent('onboarding.step_completed', {
      step: `welcome_${currentCard + 1}`,
    });
    if (isLastCard) {
      navigate('/onboarding/profile');
    } else {
      setCurrentCard((prev) => prev + 1);
    }
  }

  const card = cards[currentCard]!;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <h1 className="mbe-8 text-2xl font-bold text-text-primary">
        {t('onboarding.welcomeTitle')}
      </h1>

      <Card className="mbe-8 w-full max-w-md text-center">
        <div className="mbe-4 flex justify-center" aria-hidden="true">
          {card.icon}
        </div>
        <h2 className="mbe-2 text-lg font-semibold text-text-primary">
          {t(card.titleKey)}
        </h2>
        <p className="text-sm text-text-secondary">{t(card.bodyKey)}</p>
      </Card>

      {/* Progress dots. role="status" added (Lane MOCK_SHARD-cleanup
          Cluster F1) so the aria-label is allowed under WAI-ARIA — bare
          <div> defaults to role=generic where aria-label is prohibited
          (Phase 2F-diag-6 §6-F: axe-core "aria-prohibited-attr: aria-
          label attribute cannot be used on a div with no valid role"
          violation). status also gives assistive tech a polite live
          announcement of "Card X of N" each time `currentCard` changes,
          which is what the aria-label was already trying to convey. */}
      <div
        role="status"
        className="mbe-6 flex gap-2"
        aria-label={`Card ${currentCard + 1} of ${cards.length}`}
      >
        {cards.map((_, i) => (
          <div
            key={i}
            className={`size-2 rounded-full transition-colors ${
              i === currentCard ? 'bg-accent' : 'bg-border'
            }`}
          />
        ))}
      </div>

      <Button onClick={handleNext}>
        {isLastCard ? t('onboarding.understand') : t('common.next')}
      </Button>
    </div>
  );
}

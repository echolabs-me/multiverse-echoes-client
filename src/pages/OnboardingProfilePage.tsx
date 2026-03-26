import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../components/index.ts';
import { getComputedTokenColor } from '../lib/tokenColor.ts';
import { trackEvent } from '../lib/analytics.ts';

/** Avatar colours reference CSS design tokens so they update with the active theme. */
const AVATAR_TOKENS = [
  { id: 'avatar-1', token: '--accent' },
  { id: 'avatar-2', token: '--success' },
  { id: 'avatar-3', token: '--info' },
  { id: 'avatar-4', token: '--warning' },
  { id: 'avatar-5', token: '--danger' },
  { id: 'avatar-6', token: '--accent-renaissance-florence' },
] as const;

function getAvatarColors() {
  return AVATAR_TOKENS.map((a) => ({
    id: a.id,
    color: getComputedTokenColor(a.token),
  }));
}

export function OnboardingProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const avatars = getAvatarColors();
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_TOKENS[0].id);
  const [bio, setBio] = useState('');
  const [timezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  function handleContinue() {
    trackEvent('onboarding.step_completed', { step: 'profile' });
    trackEvent('onboarding.completed');
    navigate('/onboarding/create-echo');
  }

  function handleSkip() {
    trackEvent('onboarding.step_completed', { step: 'profile_skipped' });
    trackEvent('onboarding.completed');
    navigate('/onboarding/create-echo');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <h1 className="mb-8 text-2xl font-bold text-text-primary">
        {t('onboarding.profileTitle')}
      </h1>

      <div className="w-full max-w-md">
        {/* Avatar selection */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-text-secondary">
            {t('onboarding.avatar')}
          </label>
          <div className="flex gap-3">
            {avatars.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => setSelectedAvatar(avatar.id)}
                className={`rounded-full p-0.5 transition-all ${
                  selectedAvatar === avatar.id
                    ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas'
                    : ''
                }`}
                aria-label={`Select avatar ${avatar.id.slice(-1)}`}
                aria-pressed={selectedAvatar === avatar.id}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full text-base font-medium text-canvas"
                  style={{ backgroundColor: avatar.color || 'var(--accent)' }}
                  role="img"
                  aria-label={avatar.id}
                >
                  {avatar.id.slice(-1)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div className="mb-6">
          <Input
            label={t('onboarding.bio')}
            multiline
            value={bio}
            onChange={(e) => setBio((e.target as HTMLTextAreaElement).value)}
            placeholder={t('onboarding.bioHint')}
            maxLength={500}
          />
          <p className="mt-1 text-right text-xs text-text-muted">
            {bio.length}/500
          </p>
        </div>

        {/* Timezone */}
        <div className="mb-8">
          <label className="mb-1 block text-sm font-medium text-text-secondary">
            {t('onboarding.timezone')}
          </label>
          <p className="text-sm text-text-primary">{timezone}</p>
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleSkip} className="flex-1">
            {t('common.skip')}
          </Button>
          <Button onClick={handleContinue} className="flex-1">
            {t('common.continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}

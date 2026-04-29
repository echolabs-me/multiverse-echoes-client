import { useState, useId } from 'react';
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
  // Stable id for the Bio label -> textarea association (WCAG 2.1 Level A,
  // ME-ACC-001). Mirrors the useId pattern used inside Input.tsx itself.
  const bioLabelId = useId();
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
      <h1 className="mbe-8 text-2xl font-bold text-text-primary">
        {t('onboarding.profileTitle')}
      </h1>

      <div className="w-full max-w-md">
        {/* Avatar selection */}
        <div className="mbe-6">
          <label className="mbe-2 block text-sm font-medium text-text-secondary">
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
                  ref={(el) => {
                    if (el && avatar.color) {
                      el.style.setProperty('--me-avatar-bg', avatar.color);
                    }
                  }}
                  className="me-avatar-tint flex size-12 items-center justify-center rounded-full text-base font-medium text-canvas"
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
        <div className="mbe-6">
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div className="mbe-3 flex items-center gap-2">
              <span className="text-base" aria-hidden="true">{'\ud83d\udc64'}</span>
              <p id={bioLabelId} className="text-sm font-medium text-text-primary">
                {t('onboarding.bio')}
              </p>
            </div>
            <Input
              multiline
              aria-labelledby={bioLabelId}
              value={bio}
              onChange={(e) => setBio((e.target as HTMLTextAreaElement).value)}
              placeholder={t('onboarding.bioHint')}
              maxLength={500}
              className="min-h-25 border-accent/20 bg-canvas!"
            />
            <p className="mbs-1 text-end text-xs text-text-muted">
              {bio.length}/500
            </p>
            <div className="mbs-2 flex items-start gap-2 rounded-md bg-accent/10 px-3 py-2">
              <span className="mbs-0.5 text-base leading-none" aria-hidden="true">{'\u2728'}</span>
              <p className="text-sm text-text-secondary">
                {t('onboarding.bioCallout')}
              </p>
            </div>
          </div>
        </div>

        {/* Timezone */}
        <div className="mbe-8 flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3">
          <span className="text-base" aria-hidden="true">{'\ud83c\udf10'}</span>
          <div>
            <p className="text-sm font-medium text-text-secondary">
              {t('onboarding.timezone')}
            </p>
            <p className="text-sm text-text-primary">{timezone}</p>
          </div>
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

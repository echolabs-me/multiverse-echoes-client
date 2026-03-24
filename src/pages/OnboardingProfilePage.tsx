import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Avatar } from '../components/index.ts';

const DEFAULT_AVATARS = [
  { id: 'avatar-1', color: '#D4915C' },
  { id: 'avatar-2', color: '#6BAF7A' },
  { id: 'avatar-3', color: '#5B9EC4' },
  { id: 'avatar-4', color: '#D4A84C' },
  { id: 'avatar-5', color: '#C45B5B' },
  { id: 'avatar-6', color: '#8B6F47' },
];

export function OnboardingProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATARS[0]!.id);
  const [bio, setBio] = useState('');
  const [timezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  function handleContinue() {
    // Save profile via API in future — for now, proceed to Echo creation
    navigate('/onboarding/create-echo');
  }

  function handleSkip() {
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
            {DEFAULT_AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => setSelectedAvatar(avatar.id)}
                className={`rounded-full p-0.5 transition-all ${
                  selectedAvatar === avatar.id
                    ? 'ring-2 ring-accent ring-offset-2 ring-offset-canvas'
                    : ''
                }`}
                aria-label={`Select ${avatar.id}`}
                aria-pressed={selectedAvatar === avatar.id}
              >
                <Avatar
                  alt={avatar.id}
                  fallback={avatar.id.slice(-1)}
                  size="lg"
                />
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

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button, Input, Card } from '../components/index.ts';
import { EchoBirthAnimation } from '../components/EchoBirthAnimation.tsx';
import { useEchoStore } from '../stores/useEchoStore.ts';

type Step = 'details' | 'consent' | 'destination' | 'birth';

export function EchoCreationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createEcho = useEchoStore((s) => s.createEcho);

  const [step, setStep] = useState<Step>('details');

  // Details — single page: name + what-if + persona
  const [echoName, setEchoName] = useState('');
  const [whatIfPrompt, setWhatIfPrompt] = useState('');
  const [personaText, setPersonaText] = useState('');
  const [personaDeclaration, setPersonaDeclaration] = useState<'inspired' | 'fictional'>('inspired');

  // Consent
  const [consentAcknowledge, setConsentAcknowledge] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);

  // Birth
  const [isBirthComplete, setIsBirthComplete] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createdEchoId = useRef<string | null>(null);

  const detailsValid = echoName.trim().length >= 1 && whatIfPrompt.trim().length >= 5;

  async function handleCreate() {
    setCreateError(null);
    setStep('birth');

    try {
      const echo = await createEcho({
        name: echoName.trim(),
        persona_text: personaText || whatIfPrompt,
        what_if_prompt: whatIfPrompt,
        persona_mode: 'detailed',
        consent_declaration: true,
      });

      createdEchoId.current = echo.echo_id;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Echo creation failed';
      setCreateError(message);
      setStep('destination');
    }
  }

  function handleCancel() {
    navigate('/dashboard');
  }

  const cancelButton = (
    <button
      onClick={handleCancel}
      className="absolute right-4 top-4 rounded-md p-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      aria-label={t('common.cancel')}
    >
      <X size={20} />
    </button>
  );

  // Step 1: Name + What-If + Persona (merged U1/U2/U3)
  if (step === 'details') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
        {cancelButton}
        <h1 className="mb-2 text-2xl font-bold text-text-primary">
          {t('echo.createTitle')}
        </h1>
        <p className="mb-8 text-sm text-text-secondary">
          {t('echo.personaHint')}
        </p>

        <div className="w-full max-w-lg flex flex-col gap-4">
          <Input
            label={t('echo.nameLabel')}
            value={echoName}
            onChange={(e) => setEchoName((e.target as HTMLInputElement).value)}
            placeholder={t('echo.namePlaceholder')}
            maxLength={50}
            required
          />

          <div>
            <Input
              label={t('echo.whatIfLabel')}
              multiline
              value={whatIfPrompt}
              onChange={(e) =>
                setWhatIfPrompt((e.target as HTMLTextAreaElement).value)
              }
              placeholder={t('echo.whatIfPlaceholder')}
              maxLength={500}
            />
            <p className="mt-1 text-right text-xs text-text-muted">
              {whatIfPrompt.length}/500
            </p>
          </div>

          <div>
            <Input
              label={t('echo.personaLabel')}
              multiline
              value={personaText}
              onChange={(e) =>
                setPersonaText((e.target as HTMLTextAreaElement).value)
              }
              placeholder={t('echo.personaOptionalPlaceholder')}
              maxLength={1000}
            />
            <p className="mt-1 text-right text-xs text-text-muted">
              {personaText.length}/1000
            </p>
          </div>

          {/* Persona declaration — ME-TSP-001 §9.4 */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="radio"
                name="declaration"
                checked={personaDeclaration === 'inspired'}
                onChange={() => setPersonaDeclaration('inspired')}
                className="accent-accent"
              />
              {t('echo.personaDeclaration')}
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="radio"
                name="declaration"
                checked={personaDeclaration === 'fictional'}
                onChange={() => setPersonaDeclaration('fictional')}
                className="accent-accent"
              />
              {t('echo.personaFictional')}
            </label>
          </div>

          <Button
            onClick={() => setStep('consent')}
            disabled={!detailsValid}
            className="w-full"
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Consent
  if (step === 'consent') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
        {cancelButton}
        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          {t('echo.consentTitle')}
        </h1>

        <div className="w-full max-w-lg">
          <Card className="mb-6">
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={consentAcknowledge}
                  onChange={(e) => setConsentAcknowledge(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                {t('echo.consentAcknowledge')}
              </label>
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={consentPrivacy}
                  onChange={(e) => setConsentPrivacy(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                {t('echo.consentPrivacy')}
              </label>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setStep('details')}
              className="flex-1"
            >
              {t('common.back')}
            </Button>
            <Button
              onClick={() => setStep('destination')}
              disabled={!consentAcknowledge || !consentPrivacy}
              className="flex-1"
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Shard selection
  if (step === 'destination') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
        {cancelButton}
        <h1 className="mb-6 text-2xl font-bold text-text-primary">
          {t('echo.destinationTitle')}
        </h1>

        <div className="w-full max-w-lg">
          <Card className="mb-4 cursor-pointer border-accent">
            <h3 className="mb-1 font-semibold text-text-primary">
              {t('echo.personalShard')}
            </h3>
            <p className="text-sm text-text-secondary">
              {t('echo.personalShardDesc')}
            </p>
          </Card>

          {createError && (
            <p className="mb-4 rounded-lg bg-danger/10 px-4 py-2 text-sm text-danger">
              {createError}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setStep('consent')}
              className="flex-1"
            >
              {t('common.back')}
            </Button>
            <Button
              onClick={() => void handleCreate()}
              className="flex-1"
            >
              {t('echo.createButton')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Birth animation
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      {!isBirthComplete ? (
        <>
          <EchoBirthAnimation
            echoName={echoName || 'Echo'}
            onComplete={() => setIsBirthComplete(true)}
          />
          <h1 className="mt-6 text-2xl font-bold text-text-primary">
            {t('echo.birthTitle')}
          </h1>
        </>
      ) : (
        <>
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/20">
            <span className="text-3xl font-bold text-accent">
              {echoName[0] ?? '?'}
            </span>
          </div>
          <h1 className="mb-4 text-2xl font-bold text-text-primary">
            {t('echo.birthComplete')}
          </h1>
          <Button onClick={() => navigate('/dashboard')}>
            {t('common.continue')}
          </Button>
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Card } from '../components/index.ts';
import { EchoBirthAnimation } from '../components/EchoBirthAnimation.tsx';
import { useEchoStore } from '../stores/useEchoStore.ts';

type Step = 'persona' | 'whatif' | 'consent' | 'destination' | 'birth';

export function EchoCreationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createEcho = useEchoStore((s) => s.createEcho);

  const [step, setStep] = useState<Step>('persona');

  // Persona state
  const [personaText, setPersonaText] = useState('');
  const [personaMode, setPersonaMode] = useState<'quick' | 'detailed'>('quick');
  // Detailed mode fields
  const [echoName, setEchoName] = useState('');
  const [echoAge, setEchoAge] = useState('');

  // What-if state
  const [whatIfPrompt, setWhatIfPrompt] = useState('');
  const [personaDeclaration, setPersonaDeclaration] = useState<'inspired' | 'fictional'>('inspired');

  // Consent state
  const [consentAcknowledge, setConsentAcknowledge] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);

  // Birth state
  const [isBirthComplete, setIsBirthComplete] = useState(false);

  async function handleCreate() {
    setStep('birth');

    try {
      await createEcho({
        name: personaMode === 'detailed' ? echoName : 'My Echo',
        persona_text: personaText,
        what_if_prompt: whatIfPrompt,
        age_at_creation:
          personaMode === 'detailed' && echoAge
            ? parseInt(echoAge, 10)
            : undefined,
        persona_mode: personaMode,
        consent_declaration: true,
      });

      // Birth animation will call onComplete when done (15s or 3s for reduced motion).
    } catch {
      // On error, go back to consent
      setStep('consent');
    }
  }

  if (step === 'persona') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
        <h1 className="mb-2 text-2xl font-bold text-text-primary">
          {t('echo.createTitle')}
        </h1>
        <p className="mb-8 text-sm text-text-secondary">
          {t('echo.personaHint')}
        </p>

        <div className="w-full max-w-lg">
          {personaMode === 'quick' ? (
            <div className="mb-4">
              <Input
                label={t('echo.personaLabel')}
                multiline
                value={personaText}
                onChange={(e) =>
                  setPersonaText((e.target as HTMLTextAreaElement).value)
                }
                placeholder={t('echo.personaPlaceholder')}
                maxLength={1000}
              />
              <p className="mt-1 text-right text-xs text-text-muted">
                {personaText.length}/1000
              </p>
            </div>
          ) : (
            <div className="mb-4 flex flex-col gap-3">
              <Input
                label="Name"
                value={echoName}
                onChange={(e) =>
                  setEchoName((e.target as HTMLInputElement).value)
                }
                required
              />
              <Input
                label="Age"
                type="number"
                value={echoAge}
                onChange={(e) =>
                  setEchoAge((e.target as HTMLInputElement).value)
                }
              />
              <Input
                label={t('echo.personaLabel')}
                multiline
                value={personaText}
                onChange={(e) =>
                  setPersonaText((e.target as HTMLTextAreaElement).value)
                }
                placeholder={t('echo.personaPlaceholder')}
                maxLength={1000}
              />
            </div>
          )}

          <button
            onClick={() =>
              setPersonaMode(personaMode === 'quick' ? 'detailed' : 'quick')
            }
            className="mb-6 text-sm text-accent hover:text-accent-hover"
          >
            {personaMode === 'quick'
              ? t('echo.detailedMode')
              : 'Use Quick Mode'}
          </button>

          <Button
            onClick={() => setStep('whatif')}
            disabled={personaText.length < 10}
            className="w-full"
          >
            {t('common.next')}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'whatif') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
        <h1 className="mb-2 text-2xl font-bold text-text-primary">
          {t('echo.whatIfTitle')}
        </h1>

        <div className="w-full max-w-lg">
          <div className="mb-4">
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

          {/* Persona declaration — ME-TSP-001 §9.4 */}
          <div className="mb-6 flex flex-col gap-2">
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

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setStep('persona')}
              className="flex-1"
            >
              {t('common.back')}
            </Button>
            <Button
              onClick={() => setStep('consent')}
              disabled={whatIfPrompt.length < 5}
              className="flex-1"
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'consent') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
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
              onClick={() => setStep('whatif')}
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

  if (step === 'destination') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
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

          <Button
            onClick={() => void handleCreate()}
            className="w-full"
          >
            {t('echo.createButton')}
          </Button>
        </div>
      </div>
    );
  }

  // Birth animation — full cinematic version (Phase 5 Step 3)
  const birthName =
    personaMode === 'detailed' && echoName ? echoName : 'My Echo';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center">
      {!isBirthComplete ? (
        <>
          <EchoBirthAnimation
            echoName={birthName}
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
              {birthName[0] ?? '?'}
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

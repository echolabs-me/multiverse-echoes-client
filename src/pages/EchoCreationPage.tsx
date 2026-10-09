import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { translateCaughtError } from '../lib/translateError.ts';
import { X, Globe, Lock } from 'lucide-react';
import { Button, Input, Card, Spinner } from '../components/index.ts';
import { EchoBirthAnimation } from '../components/EchoBirthAnimation.tsx';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useSharedShardNotice } from '../hooks/useSharedShardNotice.tsx';
import { shards as shardsApi } from '../lib/api/endpoints.ts';
import { ApiRequestError } from '../lib/api/client.ts';
import { trackEvent } from '../lib/analytics.ts';
import type { Shard } from '../types/api.ts';

type Step = 'details' | 'consent' | 'destination' | 'birth';

export function EchoCreationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createEcho = useEchoStore((s) => s.createEcho);
  const sharedShardNotice = useSharedShardNotice();

  const [step, setStep] = useState<Step>('details');

  // Details — single page: name + what-if + persona + physical description
  const [echoName, setEchoName] = useState('');
  const [whatIfPrompt, setWhatIfPrompt] = useState('');
  const [personaText, setPersonaText] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState('');
  const [personaDeclaration, setPersonaDeclaration] = useState<
    'inspired' | 'fictional'
  >('inspired');

  // Consent
  const [consentAcknowledge, setConsentAcknowledge] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);

  // Shard selection. An Echo lives in an Active Public shard or an Active
  // Private shard its owner holds; no Personal shard is offered or made
  // (R409.4). The list answers the user's own Private shards only.
  const [shardOptions, setShardOptions] = useState<Shard[]>([]);
  const [selectedShardId, setSelectedShardId] = useState<string | null>(null);
  const [shardsLoading, setShardsLoading] = useState(true);
  const [shardsFailed, setShardsFailed] = useState(false);
  // Incremented to load the list again on retry.
  const [shardsAttempt, setShardsAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    shardsApi
      .list()
      .then((all) => {
        if (cancelled) return;
        const options = all.filter(
          (s) =>
            (s.shard_type === 'Public' || s.shard_type === 'Private') &&
            s.status === 'Active',
        );
        setShardOptions(options);
        setSelectedShardId(options[0]?.shard_id ?? null);
      })
      .catch(() => {
        if (!cancelled) setShardsFailed(true);
      })
      .finally(() => {
        if (!cancelled) setShardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shardsAttempt]);

  // Birth
  const [isBirthComplete, setIsBirthComplete] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createdEchoId = useRef<string | null>(null);

  const detailsValid =
    echoName.trim().length >= 1 && whatIfPrompt.trim().length >= 5;

  async function handleCreate() {
    setCreateError(null);
    if (selectedShardId === null) return;
    const shardId = selectedShardId;

    try {
      const trimmedPhysical = physicalDescription.trim();
      // Every shard offered here, Public or Private, is shared, so the
      // shared-shard notice comes first (R216.4). The notice is shown on the
      // destination step.
      const outcome = await sharedShardNotice.run(
        true,
        () => {
          setStep('birth');
          return createEcho({
            name: echoName.trim(),
            persona_text: personaText || whatIfPrompt,
            what_if_prompt: whatIfPrompt,
            persona_mode: 'detailed',
            consent_declaration: true,
            persona_declaration: personaDeclaration,
            shard_id: shardId,
            physical_description:
              trimmedPhysical.length > 0 ? trimmedPhysical : undefined,
          });
        },
        { beforeNotice: () => setStep('destination') },
      );
      if (outcome.status === 'ignored') return;
      if (outcome.status === 'cancelled') {
        setStep('destination');
        return;
      }
      const echo = outcome.value;

      createdEchoId.current = echo.echo_id;
      const shardName = shardOptions.find((s) => s.shard_id === shardId)?.name;
      trackEvent('echo.created', {
        persona_mode: 'detailed',
        target_shard: shardName ?? shardId,
      });
    } catch (err) {
      // The Echo limit has its own view with an upgrade path; any other
      // error shows the translator's text (R264.2).
      if (err instanceof ApiRequestError && err.code === 'ECHO_LIMIT_REACHED') {
        setCreateError('limit');
      } else {
        setCreateError(translateCaughtError(err));
      }
      setStep('destination');
    }
  }

  function handleCancel() {
    navigate('/dashboard');
  }

  const cancelButton = (
    <button
      onClick={handleCancel}
      className="absolute inset-e-4 inset-bs-4 rounded-md p-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      aria-label={t('common.cancel')}
    >
      <X size={20} />
    </button>
  );

  // Step 1: Name + What-If + Persona + Physical Description (uniform layout).
  // All text fields share the pattern: label → input → helper → counter.
  // No wrapper boxes, no emoji decorations, no floating callouts.
  if (step === 'details') {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12">
        {cancelButton}
        <h1 className="mbe-8 text-2xl font-bold text-text-primary">
          {t('echo.createTitle')}
        </h1>

        <div className="flex w-full max-w-lg flex-col gap-6">
          <div>
            <Input
              label={t('echo.nameLabel')}
              value={echoName}
              onChange={(e) =>
                setEchoName((e.target as HTMLInputElement).value)
              }
              placeholder={t('echo.namePlaceholder')}
              maxLength={24}
              required
            />
            <p className="mbs-1.5 text-xs text-text-secondary">
              {t('echo.nameHelper')}
            </p>
            <p className="mbs-1 text-end text-xs text-text-muted">
              {echoName.length}/24
            </p>
          </div>

          <div>
            <Input
              label={t('echo.whatIfLabel')}
              multiline
              value={whatIfPrompt}
              onChange={(e) =>
                setWhatIfPrompt((e.target as HTMLTextAreaElement).value)
              }
              placeholder={t('echo.whatIfPlaceholder')}
              maxLength={2000}
              required
              className="min-h-30"
            />
            <p className="mbs-1.5 text-xs text-text-secondary">
              {t('echo.whatIfHint')}
            </p>
            <p className="mbs-1 text-end text-xs text-text-muted">
              {whatIfPrompt.length}/2000
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
              maxLength={2000}
              className="min-h-25"
            />
            <p className="mbs-1 text-end text-xs text-text-muted">
              {personaText.length}/2000
            </p>
          </div>

          <div>
            <Input
              label={t('echo.physicalDescriptionLabel')}
              multiline
              value={physicalDescription}
              onChange={(e) =>
                setPhysicalDescription((e.target as HTMLTextAreaElement).value)
              }
              placeholder={t('echo.physicalDescriptionPlaceholder')}
              maxLength={1000}
              className="min-h-25"
            />
            <p className="mbs-1.5 text-xs text-text-secondary">
              {t('echo.physicalDescriptionHelper')}
            </p>
            <p className="mbs-1 text-end text-xs text-text-muted">
              {physicalDescription.length}/1000
            </p>
          </div>

          {/* Persona declaration — ME-TSP-001 §9.4 */}
          <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2.5">
            <span className="mbs-0.5 text-base leading-none" aria-hidden="true">
              {'\ud83c\udfad'}
            </span>
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-text-primary">
                {t('echo.personaSectionLabel')}
              </p>
              <label
                aria-label={t('echo.personaDeclaration')}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${personaDeclaration === 'inspired' ? 'border-accent/50 bg-accent/10 text-text-primary' : 'border-border bg-transparent text-text-muted'}`}
              >
                <input
                  type="radio"
                  name="declaration"
                  checked={personaDeclaration === 'inspired'}
                  onChange={() => setPersonaDeclaration('inspired')}
                  className="mbs-1 accent-accent"
                />
                <span>
                  <span className="font-medium">
                    {t('echo.personaDeclaration')}
                  </span>
                  <span
                    className={`mbs-0.5 block text-sm ${personaDeclaration === 'inspired' ? 'text-text-primary' : 'text-text-secondary'}`}
                  >
                    {t('echo.personaInspiredHint')}
                  </span>
                </span>
              </label>
              <label
                aria-label={t('echo.personaFictional')}
                className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${personaDeclaration === 'fictional' ? 'border-accent/50 bg-accent/10 text-text-primary' : 'border-border bg-transparent text-text-muted'}`}
              >
                <input
                  type="radio"
                  name="declaration"
                  checked={personaDeclaration === 'fictional'}
                  onChange={() => setPersonaDeclaration('fictional')}
                  className="mbs-1 accent-accent"
                />
                <span>
                  <span className="font-medium">
                    {t('echo.personaFictional')}
                  </span>
                  <span
                    className={`mbs-0.5 block text-sm ${personaDeclaration === 'fictional' ? 'text-text-primary' : 'text-text-secondary'}`}
                  >
                    {t('echo.personaFictionalHint')}
                  </span>
                </span>
              </label>
            </div>
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
        <h1 className="mbe-6 text-2xl font-bold text-text-primary">
          {t('echo.consentTitle')}
        </h1>

        <div className="w-full max-w-lg">
          <Card className="mbe-6">
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={consentAcknowledge}
                  onChange={(e) => setConsentAcknowledge(e.target.checked)}
                  className="mbs-0.5 accent-accent"
                />
                {t('echo.consentAcknowledge')}
              </label>
              <label className="flex items-start gap-2 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  checked={consentPrivacy}
                  onChange={(e) => setConsentPrivacy(e.target.checked)}
                  className="mbs-0.5 accent-accent"
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
        <h1 className="mbe-6 text-2xl font-bold text-text-primary">
          {t('echo.destinationTitle')}
        </h1>

        <div className="w-full max-w-lg">
          {shardsLoading ? (
            <div className="mbe-4 flex justify-center">
              <Spinner />
            </div>
          ) : shardsFailed ? (
            <div className="mbe-4 flex flex-col items-center gap-3 rounded-lg bg-danger/10 px-4 py-3">
              <p className="text-sm text-danger">{t('echo.shardListFailed')}</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setShardsLoading(true);
                  setShardsFailed(false);
                  setShardsAttempt((n) => n + 1);
                }}
              >
                {t('common.retry')}
              </Button>
            </div>
          ) : shardOptions.length === 0 ? (
            <p className="mbe-4 text-center text-sm text-text-secondary">
              {t('shardBrowser.emptyPublicDesc')}
            </p>
          ) : (
            <div className="mbe-4 flex flex-col gap-3">
              {shardOptions.map((shard) => (
                <Card
                  key={shard.shard_id}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedShardId === shard.shard_id
                      ? 'me-selected-shadow scale-[1.02] border-accent bg-accent/10! ring-2 ring-accent/25'
                      : 'scale-100 border-border opacity-60 hover:border-text-muted hover:opacity-85'
                  }`}
                  onClick={() => setSelectedShardId(shard.shard_id)}
                >
                  <div className="flex items-center gap-2">
                    {shard.shard_type === 'Private' ? (
                      <Lock
                        size={16}
                        className="text-accent"
                        aria-hidden="true"
                      />
                    ) : (
                      <Globe
                        size={16}
                        className="text-accent"
                        aria-hidden="true"
                      />
                    )}
                    <h3 className="font-semibold text-text-primary">
                      {shard.name}
                    </h3>
                    <span className="text-xs text-text-muted">
                      {shard.shard_type === 'Private'
                        ? t('shardBrowser.typePrivate')
                        : t('shardBrowser.typePublic')}
                    </span>
                  </div>
                  <p className="mbs-1 text-sm text-text-secondary">
                    {shard.description}
                  </p>
                </Card>
              ))}
            </div>
          )}

          {createError && (
            <div className="mbe-4 rounded-lg bg-danger/10 px-4 py-3">
              {createError === 'limit' ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-danger">
                    {t('echo.limitTitle')}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {t('errors.ECHO_LIMIT_REACHED')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => navigate('/dashboard')}
                    >
                      {t('common.back')}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => navigate('/plans')}
                    >
                      {t('echo.viewPlans')}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-danger">{createError}</p>
              )}
            </div>
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
              disabled={sharedShardNotice.running || selectedShardId === null}
              className="flex-1"
            >
              {t('echo.createButton')}
            </Button>
          </div>
        </div>
        {sharedShardNotice.notice}
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
          <h1 className="mbs-6 text-2xl font-bold text-text-primary">
            {t('echo.birthTitle')}
          </h1>
        </>
      ) : (
        <>
          <div className="mbe-6 flex size-24 items-center justify-center rounded-full bg-accent/10 shadow-[0_0_40px_rgba(212,145,92,0.3)]">
            <svg
              width="48"
              height="64"
              viewBox="0 0 48 64"
              fill="none"
              className="text-accent"
            >
              {/* Stylised Echo silhouette — branded birth icon */}
              <ellipse
                cx="24"
                cy="16"
                rx="11"
                ry="13"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.9"
              />
              <path
                d="M15 26 Q16 36 14 52 Q13.5 58 20 62 L28 62 Q34.5 58 34 52 Q32 36 33 26"
                stroke="currentColor"
                strokeWidth="1.5"
                opacity="0.8"
              />
              {/* Inner glow lines */}
              <line
                x1="18"
                y1="34"
                x2="30"
                y2="34"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.4"
              />
              <line
                x1="17"
                y1="42"
                x2="31"
                y2="42"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.3"
              />
              <line
                x1="17"
                y1="50"
                x2="31"
                y2="50"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.2"
              />
            </svg>
          </div>
          <h1 className="mbe-4 text-2xl font-bold text-text-primary">
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

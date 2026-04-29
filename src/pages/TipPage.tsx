import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Heart, Coins, Wallet } from 'lucide-react';
import { Card } from '../components/index.ts';
import { payments } from '../lib/api/endpoints.ts';

const PRESET_AMOUNTS = [100, 500, 1000, 2500];

export function TipPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [amount, setAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [useCustom, setUseCustom] = useState(false);

  const effectiveAmount = useCustom
    ? Math.round(parseFloat(customAmount || '0') * 100)
    : amount;

  const handleTip = async (provider: 'nowpayments' | 'xaman') => {
    if (effectiveAmount < 100) return;
    setLoading(provider);
    try {
      const result = await payments.createTip(
        provider,
        effectiveAmount,
        message || undefined,
      );
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch {
      // Error handled by API client
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="mx-auto w-full max-w-lg p-6">
        <button
          onClick={() => navigate(-1)}
          className="mbe-6 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          {t('common.back')}
        </button>

        <div className="mbe-6 flex items-center gap-2">
          <Heart size={24} className="text-accent" />
          <h1 className="text-2xl font-bold text-text-primary">
            {t('payment.tipTitle')}
          </h1>
        </div>
        <p className="mbe-6 text-sm text-text-secondary">
          {t('payment.tipDesc')}
        </p>

        <Card>
          <div className="flex flex-col gap-4">
            <label className="text-sm font-medium text-text-primary">
              {t('payment.tipAmount')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((cents) => (
                <button
                  key={cents}
                  onClick={() => {
                    setAmount(cents);
                    setUseCustom(false);
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    !useCustom && amount === cents
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'hover:bg-surface-hover border-border bg-surface text-text-primary'
                  }`}
                >
                  ${(cents / 100).toFixed(0)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setUseCustom(true)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  useCustom
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'hover:bg-surface-hover border-border bg-surface text-text-primary'
                }`}
              >
                {t('payment.tipCustom')}
              </button>
              {useCustom && (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-text-secondary">$</span>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    step="0.01"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-24 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text-primary"
                    placeholder="0.00"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="mbe-1 block text-sm font-medium text-text-primary">
                {t('payment.tipMessage')}
              </label>
              <input
                type="text"
                maxLength={200}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder-text-muted"
                placeholder={t('payment.tipMessagePlaceholder')}
              />
            </div>

            <div className="flex flex-col gap-2 pbs-2">
              <button
                onClick={() => handleTip('nowpayments')}
                disabled={loading !== null || effectiveAmount < 100}
                className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                <Coins size={16} />
                {loading === 'nowpayments'
                  ? t('payment.subscribing')
                  : `${t('payment.payWithCrypto')} — $${(effectiveAmount / 100).toFixed(2)}`}
              </button>
              <button
                onClick={() => handleTip('xaman')}
                disabled={loading !== null || effectiveAmount < 100}
                className="hover:bg-surface-hover flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-primary disabled:opacity-50"
              >
                <Wallet size={16} />
                {loading === 'xaman'
                  ? t('payment.subscribing')
                  : `${t('payment.payWithXRP')} — $${(effectiveAmount / 100).toFixed(2)}`}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

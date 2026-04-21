import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  User,
  Lock,
  Shield,
  Bell,
  Palette,
  Key,
  Trash2,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import {
  Card,
  Badge,
  Button,
  Input,
  Spinner,
} from '../components/index.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { useThemeStore } from '../stores/useThemeStore.ts';
import { useSoundStore } from '../lib/sounds.ts';
import {
  account as accountApi,
  feedback as feedbackApi,
} from '../lib/api/endpoints.ts';
import { request } from '../lib/api/client.ts';
import { trackEvent } from '../lib/analytics.ts';
import { formatDate } from '../lib/formatDate.ts';
import type { NotificationPreferences, FeedbackEntry } from '../types/api.ts';

export function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const tabs = [
    { id: 'profile', label: t('settings.profile'), icon: User },
    { id: 'account', label: t('settings.account'), icon: Lock },
    { id: 'privacy', label: t('settings.privacy'), icon: Shield },
    { id: 'notifications', label: t('settings.notificationPrefs'), icon: Bell },
    { id: 'appearance', label: t('settings.appearance'), icon: Palette },
    { id: 'apikeys', label: t('settings.apiKeys'), icon: Key },
    { id: 'feedback', label: t('settings.myFeedback'), icon: MessageSquare },
    { id: 'danger', label: t('settings.dangerZone'), icon: Trash2 },
  ];

  const tabIds = tabs.map((tab) => tab.id);
  const paramTab = searchParams.get('tab');
  const initialTab = paramTab && tabIds.includes(paramTab) ? paramTab : 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl p-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="mbe-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          <h1 className="mbe-6 text-2xl font-bold text-text-primary">
            {t('settings.title')}
          </h1>

          {/* Tab navigation */}
          <div className="mbe-6 flex flex-wrap gap-1 border-be border-border">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setSearchParams({ tab: tab.id }); }}
                  className={`flex items-center gap-1.5 border-be-2 px-3 py-2 text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'profile' && <ProfileSection />}
          {activeTab === 'account' && <AccountSection />}
          {activeTab === 'privacy' && <PrivacySection />}
          {activeTab === 'notifications' && <NotificationPrefsSection />}
          {activeTab === 'appearance' && <AppearanceSection />}
          {activeTab === 'apikeys' && <ApiKeysSection />}
          {activeTab === 'feedback' && <MyFeedbackSection />}
          {activeTab === 'danger' && <DangerZoneSection />}
        </div>
      </div>
  );
}

// --- Profile Section ---
function ProfileSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.display_name ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!editName.trim() || editName.trim().length < 3) return;
    setIsSaving(true);
    try {
      const result = await accountApi.updateProfile({ display_name: editName.trim() });
      // Update local auth store with new display name
      useAuthStore.getState().setUser({
        ...useAuthStore.getState().user!,
        display_name: result.display_name,
      });
      addToast(t('settings.displayNameSaved'), 'success');
      setIsEditing(false);
    } catch {
      addToast(t('common.error'), 'danger', { platformLink: true });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">{t('settings.profile')}</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-text-muted">{t('auth.displayName')}</label>
            {isEditing ? (
              <div className="mbs-1 flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={30}
                  className="flex-1 rounded-sm border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
                <Button onClick={() => void handleSave()} disabled={isSaving || editName.trim().length < 3}>
                  {t('common.save')}
                </Button>
                <Button variant="secondary" onClick={() => setIsEditing(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm text-text-primary">{user?.display_name || t('settings.notSet')}</p>
                <button
                  onClick={() => { setEditName(user?.display_name ?? ''); setIsEditing(true); }}
                  className="text-xs text-accent hover:text-accent-hover"
                >
                  {t('common.edit')}
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs text-text-muted">{t('auth.email')}</label>
            <p className="text-sm text-text-primary">{user?.email || t('settings.notSet')}</p>
          </div>
          <div>
            <label className="text-xs text-text-muted">{t('onboarding.timezone')}</label>
            <p className="text-sm text-text-primary">
              {user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// --- Account Section ---
function AccountSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [sessions, setSessions] = useState<Array<{
    session_id: string;
    created_at: string;
    last_active: string;
    current: boolean;
  }>>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoadingSessions(true);
      try {
        const s = await accountApi.getSessions();
        setSessions(s);
      } catch {
        // Sessions may not be available
      } finally {
        setIsLoadingSessions(false);
      }
    };
    void load();
  }, []);

  const passwordsMismatch = newPassword !== confirmPassword && confirmPassword.length > 0;

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || newPassword.length < 12) return;
    if (newPassword !== confirmPassword) return;
    setIsChanging(true);
    try {
      await accountApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      trackEvent('account.password_changed');
      addToast(t('settings.passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      addToast(t('common.error'), 'danger', { platformLink: true });
    } finally {
      setIsChanging(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await accountApi.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      addToast(t('settings.sessionRevoked'), 'success');
    } catch {
      addToast(t('common.error'), 'danger', { platformLink: true });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Subscription Tier */}
      <Card>
        <h3 className="mbe-3 text-sm font-semibold text-text-primary">
          {t('settings.subscriptionTier')}
        </h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="default">{user?.subscription_tier ?? 'Free'}</Badge>
          </div>
          <Link
            to="/plans"
            className="text-xs font-medium text-accent transition-colors hover:text-accent-hover"
          >
            {t('settings.managePlan')}
          </Link>
        </div>
      </Card>

      {/* Change Password */}
      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">
          {t('settings.changePassword')}
        </h3>
        <div className="flex flex-col gap-3">
          <Input
            type="password"
            label={t('settings.currentPassword')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            type="password"
            label={t('settings.newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t('auth.passwordHint')}
          />
          <div>
            <Input
              type="password"
              label={t('settings.confirmNewPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.passwordHint')}
            />
            {passwordsMismatch && (
              <p className="mbs-1 text-xs text-danger">{t('settings.passwordMismatchChange')}</p>
            )}
          </div>
          <Button
            onClick={() => void handleChangePassword()}
            disabled={isChanging || !currentPassword || newPassword.length < 12 || newPassword !== confirmPassword}
          >
            {t('settings.changePassword')}
          </Button>
        </div>
      </Card>

      {/* Sessions */}
      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">
          {t('settings.sessions')}
        </h3>
        {isLoadingSessions ? (
          <Spinner size="sm" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('settings.noSessions')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((session) => (
              <div
                key={session.session_id}
                className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2"
              >
                <div>
                  <p className="text-sm text-text-primary">
                    {session.current
                      ? t('settings.currentSession')
                      : `Session ${session.session_id.slice(0, 8)}...`}
                  </p>
                  <p className="text-xs text-text-muted">
                    Last active: {new Date(session.last_active).toLocaleString()}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    onClick={() => void handleRevokeSession(session.session_id)}
                  >
                    {t('settings.revokeSession')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Discord */}
      <DiscordLinkSection />
    </div>
  );
}

// --- Privacy Section ---
function PrivacySection() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [soloMode, setSoloMode] = useState(false);
  const [doNotSell, setDoNotSell] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const privacy = await accountApi.getPrivacy();
        setSoloMode(privacy.solo_mode);
        setDoNotSell(privacy.do_not_sell);
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  const handleSoloModeToggle = async () => {
    try {
      await accountApi.updatePrivacy({ solo_mode: !soloMode });
      setSoloMode(!soloMode);
    } catch {
      addToast(t('common.error'), 'danger', { platformLink: true });
    }
  };

  const handleDoNotSellToggle = async () => {
    try {
      const result = await accountApi.updatePrivacy({ do_not_sell: !doNotSell });
      setDoNotSell(result.do_not_sell);
    } catch {
      addToast(t('common.error'), 'danger', { platformLink: true });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await request<Record<string, unknown>>('/account/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'multiverse-echoes-export.json';
      a.click();
      URL.revokeObjectURL(url);
      addToast(t('settings.dataExported'), 'success');
    } catch {
      addToast(t('common.error'), 'danger', { platformLink: true });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">{t('settings.privacy')}</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              id="solo-mode-toggle"
              type="checkbox"
              checked={soloMode}
              onChange={() => void handleSoloModeToggle()}
              className="size-4 rounded-sm border-border accent-accent"
              aria-label={t('settings.soloMode')}
            />
            <label htmlFor="solo-mode-toggle">
              <span className="text-sm text-text-primary">{t('settings.soloMode')}</span>
              <p className="text-xs text-text-secondary">{t('settings.soloModeDesc')}</p>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              id="do-not-sell-toggle"
              type="checkbox"
              checked={doNotSell}
              onChange={() => void handleDoNotSellToggle()}
              className="size-4 rounded-sm border-border accent-accent"
              aria-label={t('settings.doNotSellLabel')}
            />
            <label htmlFor="do-not-sell-toggle">
              <span className="text-sm text-text-primary">{t('settings.doNotSellLabel')}</span>
              <p className="text-xs text-text-secondary">
                {t('settings.doNotSellDesc')}
              </p>
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">
          {t('settings.exportData')}
        </h3>
        <p className="mbe-3 text-sm text-text-secondary">
          {t('settings.exportDesc')}
        </p>
        <Button variant="secondary" onClick={() => void handleExport()} disabled={isExporting}>
          {isExporting ? t('settings.exporting') : t('settings.exportData')}
        </Button>
      </Card>

      <Card>
        <a
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-accent hover:text-accent/80"
        >
          <ExternalLink size={14} />
          {t('settings.privacyPolicy')}
        </a>
      </Card>
    </div>
  );
}

// --- Notification Preferences Section ---
function NotificationPrefsSection() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const p = await accountApi.getNotificationPreferences();
        setPrefs(p);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const updatePref = async (key: keyof NotificationPreferences, value: string) => {
    try {
      const updated = await accountApi.updateNotificationPreferences({ [key]: value });
      setPrefs(updated);
    } catch {
      addToast(t('common.error'), 'danger', { platformLink: true });
    }
  };

  if (isLoading || !prefs) {
    return <Spinner size="md" />;
  }

  const categories: Array<{ key: keyof NotificationPreferences; label: string }> = [
    { key: 'echo_life_events', label: t('settings.prefEchoLifeEvent') },
    { key: 'daily_digest', label: t('settings.prefDigest') },
    { key: 'social', label: t('settings.prefFollowers') },
    { key: 'community', label: t('settings.prefCommunity') },
    { key: 'shard_activity', label: t('settings.prefTravel') },
    { key: 'platform', label: t('settings.prefSystem') },
    { key: 'marketplace', label: t('settings.prefMarketplace') },
    { key: 'billing', label: t('settings.prefBilling') },
    { key: 'moderation', label: t('settings.prefModeration') },
    { key: 'account', label: t('settings.prefAccount') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">
          {t('settings.notificationPrefs')}
        </h3>
        <div className="flex flex-col gap-3">
          {categories.map(({ key, label }) => {
            const mandatory = key === 'platform' || key === 'moderation';
            const value = prefs[key] as string;
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-text-primary">{label}</span>
                {mandatory ? (
                  <span className="rounded-sm border border-border bg-surface/50 px-2 py-1 text-xs text-text-muted">
                    {t('settings.alwaysOn')}
                  </span>
                ) : (
                  <select
                    value={value}
                    onChange={(e) => void updatePref(key, e.target.value)}
                    className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                    aria-label={`${label} preference`}
                  >
                    <option value="InApp">{t('settings.inAppOnly')}</option>
                    <option value="InAppAndEmail">{t('settings.inAppAndEmail')}</option>
                    <option value="Off">{t('settings.off')}</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">{t('settings.sound')}</h3>
        <SoundSettings />
      </Card>
    </div>
  );
}

function SoundSettings() {
  const { t } = useTranslation();
  const { enabled, volume, setEnabled, setVolume } = useSoundStore();

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={() => setEnabled(!enabled)}
          className="size-4 rounded-sm border-border accent-accent"
        />
        <span className="text-sm text-text-primary">{t('settings.soundEnabled')}</span>
      </label>
      {enabled && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">{t('settings.soundVolume')}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            className="flex-1 accent-accent"
            aria-label={t('settings.soundVolume')}
          />
          <span className="text-xs text-text-muted">{Math.round(volume * 100)}%</span>
        </div>
      )}
    </div>
  );
}

// --- Appearance Section ---
function AppearanceSection() {
  const { t } = useTranslation();
  const { base, setBase, overrides, activeOverrideId, applyOverride, disable3D, setDisable3D } = useThemeStore();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">{t('settings.theme')}</h3>
        <div className="flex gap-2">
          <Button
            variant={base === 'dark' && !activeOverrideId ? 'primary' : 'secondary'}
            onClick={() => {
              applyOverride(null);
              setBase('dark');
            }}
          >
            {t('settings.darkMode')}
          </Button>
          <Button
            variant={base === 'light' && !activeOverrideId ? 'primary' : 'secondary'}
            onClick={() => {
              applyOverride(null);
              setBase('light');
            }}
          >
            {t('settings.lightMode')}
          </Button>
        </div>

        {overrides.length > 0 && (
          <div className="mbs-4">
            <h4 className="mbe-2 text-xs font-medium text-text-secondary">
              {t('settings.customThemes')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {overrides.map((o) => (
                <Button
                  key={o.id}
                  variant={activeOverrideId === o.id ? 'primary' : 'secondary'}
                  onClick={() =>
                    applyOverride(activeOverrideId === o.id ? null : o.id)
                  }
                >
                  {o.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">{t('settings.3dEnvironments')}</h3>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={!disable3D}
            onChange={(e) => setDisable3D(!e.target.checked)}
            className="size-4 rounded-sm border-border accent-accent"
          />
          <span className="text-sm text-text-secondary">
            {t('settings.enable3D')}
          </span>
        </label>
        <p className="mbs-2 text-xs text-text-secondary">
          {t('settings.3dDescription')}
        </p>
      </Card>

      <LanguageSettingsCard />
    </div>
  );
}

// --- Language Settings Card ---
// Live locale switcher: PATCH /account/me/profile → localStorage → i18n.changeLanguage.
// Dropdown shows every locale by its native name. Matches the 6 locales in
// client/src/i18n.ts SUPPORTED_LOCALES and LanguageSelectionPage.
// Reference: docs/claude/i18n-multilingual-tasks.md CC TASK 4 Part G Step 8.
function LanguageSettingsCard() {
  const { t, i18n } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [saving, setSaving] = useState(false);

  // Keep a local mirror of the active locale so the <select> reflects it
  // immediately, even before i18next fires languageChanged.
  const [activeLocale, setActiveLocale] = useState<string>(i18n.language);

  // Keep in sync with external locale changes (e.g. another tab).
  useEffect(() => {
    const handler = (lng: string) => setActiveLocale(lng);
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, [i18n]);

  // Native names match LanguageSelectionPage. Keep in lockstep.
  const options: Array<{ code: string; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'zh-Hans', label: '简体中文' },
    { code: 'zh-Hant', label: '繁體中文' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'es', label: 'Español' },
    { code: 'ar', label: 'العربية' },
    { code: 'fr', label: 'Français' },
    { code: 'bn', label: 'বাংলা' },
    { code: 'pt-BR', label: 'Português' },
    { code: 'ru', label: 'Русский' },
    { code: 'ur', label: 'اردو' },
    { code: 'id', label: 'Bahasa' },
    { code: 'de', label: 'Deutsch' },
    { code: 'ja', label: '日本語' },
    { code: 'vi', label: 'Tiếng Việt' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'ko', label: '한국어' },
    { code: 'tl', label: 'Tagalog' },
    { code: 'it', label: 'Italiano' },
    { code: 'th', label: 'ไทย' },
    { code: 'ms', label: 'Melayu' },
  ];

  const handleChange = async (newLocale: string) => {
    if (newLocale === activeLocale) return;
    setSaving(true);
    const previous = activeLocale;
    try {
      await accountApi.updateProfile({ locale: newLocale });
      localStorage.setItem('locale', newLocale);
      await i18n.changeLanguage(newLocale);
      setActiveLocale(newLocale);
      trackEvent('settings.locale_changed', {
        old_locale: previous,
        new_locale: newLocale,
      });
      addToast(t('common.saved'), 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast(msg || t('errors.INTERNAL_ERROR'), 'danger', { platformLink: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h3 className="mbe-4 text-sm font-semibold text-text-primary">
        {t('settings.language')}
      </h3>
      <label className="flex flex-col gap-2">
        <span className="text-xs text-text-secondary">
          {t('onboarding.languageSelectionLabel')}
        </span>
        <select
          value={activeLocale}
          onChange={(e) => void handleChange(e.target.value)}
          disabled={saving}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
          aria-label={t('settings.language')}
        >
          {options.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </Card>
  );
}

// --- API Keys Section ---
function ApiKeysSection() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-text-primary">{t('settings.apiKeys')}</h3>
        <p className="mbe-3 text-sm text-text-secondary">{t('settings.apiKeyComingSoon')}</p>
        <Button variant="secondary" disabled>
          {t('settings.createApiKey')}
        </Button>
      </Card>
    </div>
  );
}

// --- Discord Link Section ---
function DiscordLinkSection() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [linked, setLinked] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void accountApi
      .discordStatus()
      .then((s) => {
        setLinked(s.linked);
        setUsername(s.discord_username ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLink = async () => {
    try {
      const { auth_url } = await accountApi.linkDiscord();
      window.location.href = auth_url;
    } catch (err) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- user sees toast; dev log surfaces OAuth link-init failures (e.g. Discord config issues)
        console.error('[DiscordLink] link failed:', err);
      }
      const msg =
        err instanceof Error && err.message
          ? err.message
          : t('common.error');
      addToast(msg, 'danger', { platformLink: true });
    }
  };

  const handleUnlink = async () => {
    try {
      await accountApi.unlinkDiscord();
      setLinked(false);
      setUsername(null);
      addToast(t('settings.discordUnlinked'), 'success');
    } catch {
      addToast(t('common.error'), 'danger', { platformLink: true });
    }
  };

  if (loading) return <Card><Spinner /></Card>;

  return (
    <Card>
      <div className="mbe-4 flex items-center gap-2">
        <svg width="20" height="16" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M60.1 4.9A58.5 58.5 0 0045.4.2a.2.2 0 00-.2.1 40.8 40.8 0 00-1.8 3.7 54 54 0 00-16.2 0A37.4 37.4 0 0025.4.3a.2.2 0 00-.2-.1A58.4 58.4 0 0010.5 5a.2.2 0 00-.1 0C1.5 18.7-.9 32 .3 45.2v.1a58.9 58.9 0 0018 9.1.2.2 0 00.3-.1 42.2 42.2 0 003.6-5.9.2.2 0 00-.1-.3 38.8 38.8 0 01-5.5-2.7.2.2 0 01 0-.4l1.1-.9a.2.2 0 01.2 0 42 42 0 0035.8 0 .2.2 0 01.2 0l1.1.9a.2.2 0 010 .3 36.4 36.4 0 01-5.5 2.7.2.2 0 00-.1.3 47.3 47.3 0 003.6 5.9.2.2 0 00.3.1A58.7 58.7 0 0071 45.3v-.1C72.4 30 68.4 16.8 60.1 5a.2.2 0 00-.1 0zM23.7 37.1c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1zm23.7 0c-3.5 0-6.4-3.2-6.4-7.1s2.8-7.1 6.4-7.1 6.5 3.2 6.4 7.1c0 3.9-2.8 7.1-6.4 7.1z" fill="#5865F2"/>
        </svg>
        <h3 className="text-sm font-semibold text-text-primary">
          {t('settings.discord')}
        </h3>
      </div>
      {linked ? (
        <div className="flex items-center justify-between rounded-lg border border-[#5865F2]/30 bg-[#5865F2]/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-[#5865F2]">
              <span className="text-sm font-bold text-white">
                {(username ?? '?')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{username}</p>
              <p className="text-xs text-[#5865F2]">{t('settings.discordLinked')}</p>
            </div>
          </div>
          <button
            onClick={() => void handleUnlink()}
            className="hover:bg-surface-hover rounded-md border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors"
          >
            {t('settings.unlinkDiscord')}
          </button>
        </div>
      ) : (
        <>
          <p className="mbe-3 text-sm text-text-secondary">
            Link your Discord account to sync your identity across in-app and Discord communities.
          </p>
          <button
            onClick={() => void handleLink()}
            className="flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4752C4]"
          >
            <ExternalLink size={14} />
            {t('settings.linkDiscord')}
          </button>
        </>
      )}
    </Card>
  );
}

// --- My Feedback Section ---
function MyFeedbackSection() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void feedbackApi.myFeedback().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <Card>
      <h3 className="mbe-3 text-sm font-semibold text-text-primary">
        {t('settings.myFeedback')}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('settings.noFeedbackYet')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.feedback_id}
              className="rounded-sm border border-border p-3"
            >
              <div className="mbe-1 flex items-center gap-2 text-xs">
                <span className="font-medium text-accent">{item.feedback_type}</span>
                <span className="text-text-muted">·</span>
                <span className={item.status === 'Resolved' ? 'text-success' : 'text-text-muted'}>
                  {item.status}
                </span>
                <span className="text-text-muted">·</span>
                <span className="text-text-muted">
                  {t('settings.feedbackSubmitted')} {formatDate(item.created_at)}
                </span>
              </div>
              <p className="text-sm text-text-primary">{item.user_message}</p>
              {item.resolution_notes && (
                <p className="mbs-1 text-xs text-success italic">
                  Resolution: {item.resolution_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// --- Danger Zone Section ---
function DangerZoneSection() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const user = useAuthStore((s) => s.user);
  const [isCancelling, setIsCancelling] = useState(false);

  const deletionScheduledAt = user?.deletion_scheduled_at;
  const isPendingDeletion = user?.account_status === 'PendingDeletion';

  const handleCancelDeletion = async () => {
    setIsCancelling(true);
    try {
      await accountApi.cancelDeletion();
      trackEvent('account.deletion_cancelled');
      addToast(t('settings.deletionCancelled'), 'success');
      // Refresh profile to update status
      const fetchProfile = useAuthStore.getState().fetchProfile;
      await fetchProfile();
    } catch {
      addToast(t('common.error'), 'danger', { platformLink: true });
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mbe-4 text-sm font-semibold text-danger">{t('settings.dangerZone')}</h3>

        {isPendingDeletion && deletionScheduledAt ? (
          <div className="mbe-4">
            <div className="mbe-3 rounded-md border border-danger/30 bg-danger/10 p-3">
              <p className="text-sm font-medium text-danger">
                {t('settings.deletionScheduled', { date: formatDate(deletionScheduledAt) })}
              </p>
              <p className="mbs-1 text-xs text-text-secondary">
                {t('settings.deletionScheduledDesc')}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => void handleCancelDeletion()}
              disabled={isCancelling}
            >
              {isCancelling ? t('settings.cancelling') : t('settings.cancelDeletion')}
            </Button>
          </div>
        ) : (
          <>
            <p className="mbe-4 text-sm text-text-secondary">
              {t('settings.deleteAccountWarning')}
            </p>
            <Button variant="danger" onClick={() => navigate('/settings/delete-account')}>
              {t('settings.deleteAccount')}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

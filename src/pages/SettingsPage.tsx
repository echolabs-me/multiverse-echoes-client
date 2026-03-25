import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Copy,
  Check,
} from 'lucide-react';
import {
  TopBar,
  Card,
  Button,
  Input,
  Spinner,
} from '../components/index.ts';
import { useToastStore } from '../stores/useToastStore.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { useThemeStore } from '../stores/useThemeStore.ts';
import { useSoundStore } from '../lib/sounds.ts';
import {
  account as accountApi,
  apiKeys as apiKeysApi,
} from '../lib/api/endpoints.ts';
import type { ApiKey, NotificationPreferences } from '../types/api.ts';

export function SettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const tabs = [
    { id: 'profile', label: t('settings.profile'), icon: User },
    { id: 'account', label: t('settings.account'), icon: Lock },
    { id: 'privacy', label: t('settings.privacy'), icon: Shield },
    { id: 'notifications', label: t('settings.notificationPrefs'), icon: Bell },
    { id: 'appearance', label: t('settings.appearance'), icon: Palette },
    { id: 'apikeys', label: t('settings.apiKeys'), icon: Key },
    { id: 'danger', label: t('settings.dangerZone'), icon: Trash2 },
  ];

  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar
        notificationCount={unreadCount}
        onSearchClick={() => {}}
        onNotificationClick={() => navigate('/notifications')}
        onProfileClick={() => {}}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          <h1 className="mb-6 text-2xl font-bold text-text-primary">
            {t('settings.title')}
          </h1>

          {/* Tab navigation */}
          <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
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
          {activeTab === 'danger' && <DangerZoneSection />}
        </div>
      </div>
    </div>
  );
}

// --- Profile Section ---
function ProfileSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.display_name ?? '');

  const handleSave = () => {
    if (!editName.trim() || editName.trim().length < 3) return;
    // Display name update requires a dedicated endpoint (deferred).
    // For now, just close the editor.
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{t('settings.profile')}</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-text-muted">{t('auth.displayName')}</label>
            {isEditing ? (
              <div className="mt-1 flex gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={30}
                  className="flex-1 rounded border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
                <Button onClick={handleSave} disabled={editName.trim().length < 3}>
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
  const addToast = useToastStore((s) => s.addToast);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
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

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || newPassword.length < 12) return;
    setIsChanging(true);
    try {
      await accountApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      addToast(t('settings.passwordChanged'), 'success');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      addToast(t('common.error'), 'danger');
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
      addToast(t('common.error'), 'danger');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Change Password */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
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
          <Button
            onClick={() => void handleChangePassword()}
            disabled={isChanging || !currentPassword || newPassword.length < 12}
          >
            {t('settings.changePassword')}
          </Button>
        </div>
      </Card>

      {/* Sessions */}
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          {t('settings.sessions')}
        </h3>
        {isLoadingSessions ? (
          <Spinner size="sm" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-text-muted">{t('settings.noSessions')}</p>
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
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          {t('settings.discord')}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const result = await accountApi.linkDiscord();
                window.open(result.auth_url, '_blank');
              } catch {
                addToast(t('common.error'), 'danger');
              }
            }}
          >
            {t('settings.linkDiscord')}
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await accountApi.unlinkDiscord();
                addToast(t('settings.discordUnlinked'), 'success');
              } catch {
                addToast(t('common.error'), 'danger');
              }
            }}
          >
            {t('settings.unlinkDiscord')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// --- Privacy Section ---
function PrivacySection() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [soloMode, setSoloMode] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const privacy = await accountApi.getPrivacy();
        setSoloMode(privacy.solo_mode);
      } catch {
        // ignore
      }
    };
    void load();
  }, []);

  const handleSoloModeToggle = async () => {
    try {
      await accountApi.updatePrivacy(!soloMode);
      setSoloMode(!soloMode);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleExport = async () => {
    try {
      await accountApi.requestExport();
      addToast(t('settings.exportRequested'), 'success');
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{t('settings.privacy')}</h3>
        <div className="flex items-center gap-3">
          <input
            id="solo-mode-toggle"
            type="checkbox"
            checked={soloMode}
            onChange={() => void handleSoloModeToggle()}
            className="h-4 w-4 rounded border-border accent-accent"
            aria-label={t('settings.soloMode')}
          />
          <label htmlFor="solo-mode-toggle">
            <span className="text-sm text-text-primary">{t('settings.soloMode')}</span>
            <p className="text-xs text-text-muted">{t('settings.soloModeDesc')}</p>
          </label>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          {t('settings.exportData')}
        </h3>
        <Button variant="secondary" onClick={() => void handleExport()}>
          {t('settings.exportData')}
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
      addToast(t('common.error'), 'danger');
    }
  };

  if (isLoading || !prefs) {
    return <Spinner size="md" />;
  }

  const categories: Array<{ key: keyof NotificationPreferences; label: string }> = [
    { key: 'echo_life_event', label: t('settings.prefEchoLifeEvent') },
    { key: 'echo_diary', label: t('settings.prefDiary') },
    { key: 'community_message', label: t('settings.prefCommunity') },
    { key: 'follow', label: t('settings.prefFollowers') },
    { key: 'system', label: t('settings.prefSystem') },
    { key: 'travel', label: t('settings.prefTravel') },
    { key: 'influence', label: t('settings.prefInfluence') },
    { key: 'daily_digest', label: t('settings.prefDigest') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          {t('settings.notificationPrefs')}
        </h3>
        <div className="flex flex-col gap-3">
          {categories.map(({ key, label }) => {
            const value = prefs[key] as string;
            return (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-text-primary">{label}</span>
                <select
                  value={value}
                  onChange={(e) => void updatePref(key, e.target.value)}
                  className="rounded border border-border bg-surface px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                  aria-label={`${label} preference`}
                >
                  <option value="InApp">{t('settings.inAppOnly')}</option>
                  <option value="InAppAndEmail">{t('settings.inAppAndEmail')}</option>
                  <option value="Off">{t('settings.off')}</option>
                </select>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{t('settings.sound')}</h3>
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
          className="h-4 w-4 rounded border-border accent-accent"
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
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{t('settings.theme')}</h3>
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
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-medium text-text-secondary">
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
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{t('settings.3dEnvironments')}</h3>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={!disable3D}
            onChange={(e) => setDisable3D(!e.target.checked)}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          <span className="text-sm text-text-secondary">
            {t('settings.enable3D')}
          </span>
        </label>
        <p className="mt-2 text-xs text-text-muted">
          {t('settings.3dDescription')}
        </p>
      </Card>

      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{t('settings.language')}</h3>
        <p className="text-sm text-text-muted">
          {t('settings.languageNote')}
        </p>
      </Card>
    </div>
  );
}

// --- API Keys Section ---
function ApiKeysSection() {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const k = await apiKeysApi.list();
        setKeys(k);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    try {
      const result = await apiKeysApi.create({ name: newKeyName.trim() });
      setCreatedKey(result.api_key);
      setKeys((prev) => [
        ...prev,
        { key_id: result.key_id, name: result.name, last_four: result.api_key.slice(-4), created_at: new Date().toISOString() },
      ]);
      setNewKeyName('');
      addToast(t('settings.apiKeyCreated'), 'success');
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await apiKeysApi.revoke(keyId);
      setKeys((prev) => prev.filter((k) => k.key_id !== keyId));
      addToast(t('settings.apiKeyRevoked'), 'success');
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-text-primary">{t('settings.apiKeys')}</h3>

        {/* Create new key */}
        <div className="mb-4 flex gap-2">
          <Input
            label={t('settings.apiKeyName')}
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="My API Key"
          />
          <Button
            onClick={() => void handleCreate()}
            disabled={!newKeyName.trim()}
            className="self-end"
          >
            {t('settings.createApiKey')}
          </Button>
        </div>

        {/* Show created key */}
        {createdKey && (
          <div className="mb-4 rounded-lg border border-accent bg-accent-subtle p-3">
            <p className="mb-1 text-xs text-text-muted">{t('settings.apiKeyCreated')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-text-primary">{createdKey}</code>
              <button
                onClick={() => void handleCopy(createdKey)}
                className="text-accent hover:text-accent/80"
                aria-label={t('common.copyToClipboard')}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* Key list */}
        {isLoading ? (
          <Spinner size="sm" />
        ) : keys.length === 0 ? (
          <p className="text-sm text-text-muted">{t('settings.noApiKeys')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {keys.map((key) => (
              <div
                key={key.key_id}
                className="flex items-center justify-between rounded-lg bg-surface-raised px-3 py-2"
              >
                <div>
                  <p className="text-sm text-text-primary">{key.name}</p>
                  <p className="text-xs text-text-muted">
                    ...{key.last_four} &middot; Created{' '}
                    {new Date(key.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => void handleRevoke(key.key_id)}
                >
                  {t('settings.revokeApiKey')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// --- Danger Zone Section ---
function DangerZoneSection() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-danger">{t('settings.dangerZone')}</h3>
        <p className="mb-4 text-sm text-text-secondary">
          {t('settings.deleteAccountWarning')}
        </p>
        <Button variant="danger" onClick={() => navigate('/settings/delete-account')}>
          {t('settings.deleteAccount')}
        </Button>
      </Card>
    </div>
  );
}

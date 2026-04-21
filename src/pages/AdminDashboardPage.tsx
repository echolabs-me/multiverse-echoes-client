import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Users,
  Globe,
  Shield,
  Database,
  Search,
  Clock,
} from 'lucide-react';
import { Tabs, Button, Badge, Spinner, Card } from '../components/index.ts';
import { useAuthStore } from '../stores/index.ts';
import { admin } from '../lib/api/endpoints.ts';
import { request } from '../lib/api/client.ts';
import type {
  SystemHealth,
  AdminReport,
  AdminUser,
  Shard,
  FeedbackEntry,
  FeedbackStatus,
  FeedbackPriority,
  ModeratorUserItem,
} from '../types/api.ts';

type AdminTab =
  | 'dashboard'
  | 'reports'
  | 'users'
  | 'shards'
  | 'controls'
  | 'analytics'
  | 'feedback'
  | 'moderators';

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Gate: Admin only
  if (!user || user.account_type !== 'Admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center">
          <Shield size={48} className="mx-auto mbe-4 text-danger" />
          <h1 className="text-xl font-semibold text-text-primary">{t('admin.accessDenied')}</h1>
          <p className="mbs-2 text-text-secondary">{t('admin.accessDeniedDesc')}</p>
          <Button className="mbs-4" onClick={() => navigate('/dashboard')}>
            {t('common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: t('admin.tabDashboard') },
    { id: 'reports', label: t('admin.tabReports') },
    { id: 'users', label: t('admin.tabUsers') },
    { id: 'moderators', label: t('admin.tabModerators') },
    { id: 'shards', label: t('admin.tabShards') },
    { id: 'controls', label: t('admin.tabControls') },
    { id: 'analytics', label: t('admin.tabAnalytics') },
    { id: 'feedback', label: t('admin.tabFeedback') },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="border-be border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-accent" />
          <h1 className="text-xl font-semibold text-text-primary">{t('admin.title')}</h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-be border-border px-6">
        <Tabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as AdminTab)}
        />
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl p-6">
        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'reports' && <ReportsView />}
        {activeTab === 'users' && <UsersView />}
        {activeTab === 'moderators' && <ModeratorsView />}
        {activeTab === 'shards' && <ShardsView />}
        {activeTab === 'controls' && <ControlsView />}
        {activeTab === 'analytics' && <AnalyticsView />}
        {activeTab === 'feedback' && <FeedbackQueueView />}
      </div>
    </div>
  );
}

// --- Dashboard View ---
function DashboardView() {
  const { t } = useTranslation();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setHealth(await admin.systemHealth());
      } catch {
        // Will show empty state
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  if (isLoading) return <Spinner />;

  const metrics = health
    ? [
        { label: t('admin.tickNumber'), value: String(health.tick_number), icon: <Activity size={16} /> },
        { label: t('admin.tickDuration'), value: `${String(health.tick_duration_ms)}ms`, icon: <Clock size={16} />, warn: health.tick_duration_ms > 5000 },
        { label: t('admin.ramUsage'), value: `${String(health.ram_usage_mb)} MB`, icon: <Database size={16} />, warn: health.ram_usage_mb > 4096 },
        { label: t('admin.vramUsage'), value: health.vram_total_mb > 0 ? `${String(health.vram_usage_mb)} / ${String(health.vram_total_mb)} MB` : `${String(health.vram_usage_mb)} MB`, icon: <Database size={16} />, warn: health.vram_total_mb > 0 && (health.vram_usage_mb / health.vram_total_mb) > 0.9 },
        { label: t('admin.activeEchoes'), value: String(health.active_echoes), icon: <Users size={16} /> },
        { label: t('admin.hibernatedEchoes'), value: String(health.hibernated_echoes), icon: <Users size={16} /> },
        { label: t('admin.totalUsers'), value: String(health.total_users), icon: <Users size={16} /> },
        { label: t('admin.totalShards'), value: String(health.total_shards), icon: <Globe size={16} /> },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <div className="flex items-center gap-2">
              <span className={m.warn ? 'text-danger' : 'text-text-muted'}>{m.icon}</span>
              <div>
                <p className="text-xs text-text-muted">{m.label}</p>
                <p className={`text-lg font-semibold ${m.warn ? 'text-danger' : 'text-text-primary'}`}>
                  {m.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

    </div>
  );
}

// --- Reports View ---
function ReportsView() {
  const { t } = useTranslation();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveAction, setResolveAction] = useState<string>('Dismiss');
  const [resolveNotes, setResolveNotes] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const r = await admin.reports();
        // Sort by priority (T3 first) then by created_at
        r.sort((a, b) => {
          const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
          const pa = priorityOrder[a.priority] ?? 99;
          const pb = priorityOrder[b.priority] ?? 99;
          if (pa !== pb) return pa - pb;
          return b.created_at.localeCompare(a.created_at);
        });
        setReports(r);
      } catch {
        // Will show empty state
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const handleResolve = async () => {
    if (!resolveId || !resolveNotes.trim()) return;
    try {
      await admin.resolveReport(resolveId, {
        action: resolveAction as 'Quarantine' | 'Warn' | 'Suspend' | 'Dismiss' | 'Restore',
        notes: resolveNotes,
      });
      setReports((prev) => prev.filter((r) => r.report_id !== resolveId));
      setResolveId(null);
      setResolveNotes('');
    } catch {
      // Error handling
    }
  };

  if (isLoading) return <Spinner />;

  const priorityColors: Record<string, string> = {
    P0: 'danger',
    P1: 'warning',
    P2: 'info',
    P3: 'default',
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-secondary">
        {t('admin.reportQueue')} ({reports.length})
      </h3>
      {reports.length === 0 ? (
        <p className="py-8 text-center text-text-muted">{t('admin.noReports')}</p>
      ) : (
        reports.map((report) => (
          <Card key={report.report_id}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant={priorityColors[report.priority] as 'danger' | 'warning' | 'default'}>
                    {report.priority}
                  </Badge>
                  <span className="text-sm font-medium text-text-primary">
                    {report.target_type}: {report.target_id.slice(0, 8)}
                  </span>
                </div>
                <p className="mbs-1 text-sm text-text-secondary">{report.reason}</p>
                {report.details && (
                  <p className="mbs-1 text-xs text-text-muted">{report.details}</p>
                )}
                <div className="mbs-2 flex items-center gap-3 text-xs text-text-muted">
                  <span>{new Date(report.created_at).toLocaleString()}</span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {t('admin.slaDeadline')}: {new Date(report.sla_deadline).toLocaleString()}
                  </span>
                </div>
              </div>

              {resolveId === report.report_id ? (
                <div className="flex flex-col gap-2">
                  <select
                    value={resolveAction}
                    onChange={(e) => setResolveAction(e.target.value)}
                    className="rounded-sm border border-border bg-surface px-2 py-1 text-sm text-text-primary"
                    aria-label={t('admin.selectAction')}
                  >
                    <option value="Quarantine">{t('admin.actionQuarantine')}</option>
                    <option value="Warn">{t('admin.actionWarn')}</option>
                    <option value="Suspend">{t('admin.actionSuspend')}</option>
                    <option value="Dismiss">{t('admin.actionDismiss')}</option>
                    <option value="Restore">{t('admin.actionRestore')}</option>
                  </select>
                  <textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder={t('admin.resolutionNotes')}
                    className="rounded-sm border border-border bg-surface px-2 py-1 text-sm text-text-primary"
                    rows={2}
                    aria-label={t('admin.resolutionNotes')}
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="primary"
                      onClick={() => void handleResolve()}
                      disabled={!resolveNotes.trim()}
                      className="text-xs"
                    >
                      {t('common.confirm')}
                    </Button>
                    <Button variant="ghost" onClick={() => setResolveId(null)} className="text-xs">
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setResolveId(report.report_id)} className="text-xs">
                  {t('admin.resolve')}
                </Button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// --- Users View ---
function UsersView() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsers = useCallback(async (q?: string) => {
    setIsLoading(true);
    try {
      const u = await admin.users(q ? { q } : undefined);
      setUsers(u);
    } catch {
      // Will show empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadUsers(searchQuery || undefined);
  };

  const handleSuspendToggle = async (userId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'Suspended') {
        await admin.unsuspendUser(userId);
      } else {
        await admin.suspendUser(userId);
      }
      void loadUsers(searchQuery || undefined);
    } catch {
      // Error handling
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute inset-s-3 inset-bs-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.searchUsers')}
            className="w-full rounded-md border border-border bg-surface py-2 ps-9 pe-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            aria-label={t('admin.searchUsers')}
          />
        </div>
        <Button type="submit">{t('common.search')}</Button>
      </form>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-be border-border text-start text-text-muted">
                <th className="px-3 py-2">{t('admin.userName')}</th>
                <th className="px-3 py-2">{t('admin.userEmail')}</th>
                <th className="px-3 py-2">{t('admin.userTier')}</th>
                <th className="px-3 py-2">{t('admin.userStatus')}</th>
                <th className="px-3 py-2">{t('admin.userEchoes')}</th>
                <th className="px-3 py-2">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-be border-border">
                  <td className="px-3 py-2 text-text-primary">{u.display_name}</td>
                  <td className="px-3 py-2 text-text-secondary">{u.email}</td>
                  <td className="px-3 py-2">
                    <Badge variant="default">{u.subscription_tier}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={
                        u.account_status === 'Active'
                          ? 'success'
                          : u.account_status === 'Suspended'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {u.account_status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{u.echo_count}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant={u.account_status === 'Suspended' ? 'primary' : 'danger'}
                      className="text-xs"
                      onClick={() => void handleSuspendToggle(u.user_id, u.account_status)}
                    >
                      {u.account_status === 'Suspended'
                        ? t('admin.unsuspend')
                        : t('admin.suspend')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <p className="py-8 text-center text-text-muted">{t('common.noResults')}</p>
          )}
        </div>
      )}
    </div>
  );
}

// --- Shards View ---
function ShardsView() {
  const { t } = useTranslation();
  const [shards, setShards] = useState<Shard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setShards(await admin.shards());
      } catch {
        // Will show empty
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          <thead>
            <tr className="border-be border-border text-start text-text-muted">
              <th className="px-3 py-2">{t('admin.shardName')}</th>
              <th className="px-3 py-2">{t('admin.shardType')}</th>
              <th className="px-3 py-2">{t('admin.shardStatus')}</th>
              <th className="px-3 py-2">{t('admin.shardPopulation')}</th>
            </tr>
          </thead>
          <tbody>
            {shards.map((s) => {
              const capacityPct = s.max_active_echoes > 0 ? (s.current_active_count / s.max_active_echoes) * 100 : 0;
              return (
                <tr key={s.shard_id} className="border-be border-border">
                  <td className="px-3 py-2 text-text-primary">{s.name}</td>
                  <td className="px-3 py-2 text-text-secondary">{s.shard_type}</td>
                  <td className="px-3 py-2">
                    <Badge variant={s.status === 'Active' ? 'success' : 'default'}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={capacityPct > 90 ? 'text-danger' : 'text-text-secondary'}>
                        {s.current_active_count} / {s.max_active_echoes}
                      </span>
                      <div className="h-2 w-16 overflow-hidden rounded-full bg-surface-raised">
                        <div
                          ref={(el) => {
                            if (el) {
                              el.style.setProperty('--me-progress', `${Math.min(capacityPct, 100)}%`);
                            }
                          }}
                          className={`me-progress-bar h-full rounded-full transition-all ${
                            capacityPct > 90
                              ? 'bg-danger'
                              : capacityPct > 70
                                ? 'bg-warning'
                                : 'bg-success'
                          }`}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shards.length === 0 && (
          <p className="py-8 text-center text-text-muted">{t('common.noResults')}</p>
        )}
      </div>
    </div>
  );
}

// --- Controls View ---
function ControlsView() {
  const { t } = useTranslation();
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void admin.tickStatus().then((s) => setPaused(s.paused)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleToggle = async () => {
    try {
      if (paused) {
        const r = await admin.tickResume();
        setPaused(r.paused);
      } else {
        const r = await admin.tickPause();
        setPaused(r.paused);
      }
    } catch { /* */ }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mbe-3 text-sm font-semibold text-text-secondary">{t('admin.tickControl')}</h3>
        <div className="flex items-center gap-4">
          <Badge variant={paused ? 'warning' : 'success'}>
            {paused ? 'Paused' : 'Running'}
          </Badge>
          <Button
            variant={paused ? 'primary' : 'secondary'}
            onClick={() => void handleToggle()}
          >
            {paused ? t('admin.resumeTick') : t('admin.pauseTick')}
          </Button>
        </div>
        {paused && (
          <p className="mbs-3 text-xs text-text-muted">
            Tick engine is paused. No Echoes will be processed until resumed.
          </p>
        )}
      </Card>
      <Card>
        <h3 className="mbe-3 text-sm font-semibold text-text-secondary">{t('admin.manualTick')}</h3>
        <p className="mbe-3 text-xs text-text-muted">{t('admin.manualTickDesc')}</p>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await admin.triggerTick();
            } catch { /* */ }
          }}
        >
          {t('admin.triggerTick')}
        </Button>
      </Card>
    </div>
  );
}

// --- Analytics View ---
interface AnalyticsSummary {
  dau: number;
  registrations_7d: number;
  echo_creations_7d: number;
  diary_views_today: number;
  safety_flagged_7d: number;
  mrr: number;
  subscriber_count: Record<string, number>;
  churn_rate: number;
}

function AnalyticsView() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await request<AnalyticsSummary>('/admin/analytics/summary');
        setSummary(data);
      } catch {
        // Will show empty state
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  if (isLoading) return <Spinner />;
  if (!summary) return <p className="py-8 text-center text-text-muted">{t('admin.analyticsLoadFailed')}</p>;

  const metrics = [
    { label: 'DAU (Daily Active Users)', value: String(summary.dau), icon: <Users size={16} /> },
    { label: 'Registrations (7d)', value: String(summary.registrations_7d), icon: <Users size={16} /> },
    { label: 'Echo Creations (7d)', value: String(summary.echo_creations_7d), icon: <Activity size={16} /> },
    { label: 'Diary Views (today)', value: String(summary.diary_views_today), icon: <Activity size={16} /> },
    { label: 'Content Flagged (7d)', value: String(summary.safety_flagged_7d), icon: <AlertTriangle size={16} />, warn: summary.safety_flagged_7d > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.label}>
            <div className="flex items-center gap-2">
              <span className={m.warn ? 'text-danger' : 'text-text-muted'}>{m.icon}</span>
              <div>
                <p className="text-xs text-text-muted">{m.label}</p>
                <p className={`text-lg font-semibold ${m.warn ? 'text-danger' : 'text-text-primary'}`}>
                  {m.value}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Revenue (stubs) */}
      <Card>
        <h3 className="mbe-3 text-sm font-semibold text-text-secondary">{t('admin.revenueCard')}</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-text-muted">{t('admin.revenueMrr')}</p>
            <p className="text-lg font-semibold text-text-primary">${summary.mrr}</p>
          </div>
          <div>
            <p className="text-text-muted">{t('admin.revenueChurn')}</p>
            <p className="text-lg font-semibold text-text-primary">{summary.churn_rate}%</p>
          </div>
          <div>
            <p className="text-text-muted">{t('admin.revenueSubscribers')}</p>
            <p className="text-text-secondary">{t('admin.revenuePending')}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Feedback Queue ──────────────────────────────────────────────────────────

function FeedbackQueueView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const load = useCallback(() => {
    void admin.feedback().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (id: string, status: FeedbackStatus, notes?: string) => {
    try {
      await admin.updateFeedbackStatus(id, status, notes);
      load();
    } catch { /* toast in future */ }
  };

  const handlePriority = async (id: string, priority: FeedbackPriority) => {
    try {
      await admin.updateFeedbackPriority(id, priority);
      load();
    } catch { /* toast in future */ }
  };

  const filtered = items.filter((i) => {
    if (filterType !== 'all' && i.feedback_type !== filterType) return false;
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    return true;
  });

  if (loading) return <Spinner />;

  const typeBadgeColor: Record<string, 'danger' | 'warning' | 'success' | 'default'> = {
    Bug: 'danger',
    Frustration: 'warning',
    FeatureRequest: 'default',
    Praise: 'success',
    General: 'default',
  };

  return (
    <div>
      <h2 className="mbe-4 text-lg font-semibold text-text-primary">{t('admin.feedbackQueue')}</h2>

      <div className="mbe-4 flex gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-sm border border-border bg-surface px-2 py-1 text-sm text-text-primary"
        >
          <option value="all">{t('admin.feedbackType')}: {t('admin.filterAll')}</option>
          <option value="Bug">{t('admin.feedbackTypeBug')}</option>
          <option value="FeatureRequest">{t('admin.feedbackTypeFeatureRequest')}</option>
          <option value="Frustration">{t('admin.feedbackTypeFrustration')}</option>
          <option value="Praise">{t('admin.feedbackTypePraise')}</option>
          <option value="General">{t('admin.feedbackTypeGeneral')}</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-sm border border-border bg-surface px-2 py-1 text-sm text-text-primary"
        >
          <option value="all">{t('admin.feedbackStatus')}: {t('admin.filterAll')}</option>
          <option value="New">{t('admin.feedbackStatusNew')}</option>
          <option value="Acknowledged">{t('admin.feedbackStatusAcknowledged')}</option>
          <option value="Resolved">{t('admin.feedbackStatusResolved')}</option>
          <option value="Wontfix">{t('admin.feedbackStatusWontfix')}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-text-muted">{t('admin.noFeedback')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <Card key={item.feedback_id}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mbe-1 flex items-center gap-2">
                    <Badge variant={typeBadgeColor[item.feedback_type] ?? 'default'}>
                      {item.feedback_type}
                    </Badge>
                    <Badge variant={item.status === 'New' ? 'warning' : 'default'}>
                      {item.status}
                    </Badge>
                    {item.priority && <Badge variant="danger">{item.priority}</Badge>}
                  </div>
                  <p className="text-sm text-text-primary">{item.user_message}</p>
                  <p className="mbs-1 text-xs text-text-muted italic">{item.structured_summary}</p>
                  <p className="mbs-1 text-xs text-text-muted">
                    {t('admin.feedbackScreen')}: {item.context.screen}
                    {item.context.echo_id && ` · Echo: ${item.context.echo_id.slice(0, 8)}…`}
                  </p>
                  {item.github_issue_url && (
                    <p className="mbs-1 text-xs">
                      <a
                        href={item.github_issue_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline hover:text-accent/80"
                      >
                        GitHub Issue
                      </a>
                    </p>
                  )}
                  {item.resolution_notes && (
                    <p className="mbs-1 text-xs text-success">{t('admin.resolutionPrefix')}: {item.resolution_notes}</p>
                  )}
                  <p className="mbs-1 text-xs text-text-muted">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  {item.status === 'New' && (
                    <Button
                      variant="secondary"
                      onClick={() => void handleStatus(item.feedback_id, 'Acknowledged')}
                    >
                      {t('admin.feedbackAcknowledge')}
                    </Button>
                  )}
                  {item.status !== 'Resolved' && item.status !== 'Wontfix' && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const notes = prompt(t('admin.feedbackResolutionNotes'));
                        if (notes !== null) void handleStatus(item.feedback_id, 'Resolved', notes);
                      }}
                    >
                      {t('admin.feedbackResolve')}
                    </Button>
                  )}
                  <select
                    value={item.priority ?? ''}
                    onChange={(e) => {
                      if (e.target.value) void handlePriority(item.feedback_id, e.target.value as FeedbackPriority);
                    }}
                    className="rounded-sm border border-border bg-surface px-2 py-1 text-xs text-text-primary"
                  >
                    <option value="">{t('admin.feedbackPriorityLabel')}</option>
                    <option value="P0">P0</option>
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                    <option value="P3">P3</option>
                    <option value="P4">P4</option>
                  </select>
                  {item.status === 'Acknowledged' &&
                    item.priority &&
                    item.priority !== 'P4' &&
                    !item.github_issue_url && (
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await admin.createGithubIssue(item.feedback_id);
                            load();
                          } catch {
                            /* toast in future */
                          }
                        }}
                      >
                        Create Issue
                      </Button>
                    )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Moderators View ---
function ModeratorsView() {
  const { t } = useTranslation();
  const [moderators, setModerators] = useState<ModeratorUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [promoteUserId, setPromoteUserId] = useState('');
  const [confirmDemoteId, setConfirmDemoteId] = useState<string | null>(null);

  const loadModerators = useCallback(async () => {
    setIsLoading(true);
    try {
      const m = await admin.listModerators();
      m.sort((a, b) => a.display_name.localeCompare(b.display_name));
      setModerators(m);
    } catch {
      // Will show empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadModerators();
  }, [loadModerators]);

  const handlePromote = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = promoteUserId.trim();
    if (!trimmed) return;
    try {
      await admin.promoteModerator(trimmed);
      setPromoteUserId('');
      void loadModerators();
    } catch {
      // Will show empty
    }
  };

  const handleDemote = async (userId: string) => {
    try {
      await admin.demoteModerator(userId);
      setConfirmDemoteId(null);
      void loadModerators();
    } catch {
      // Will show empty
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void handlePromote(e)} className="flex gap-2">
        <div className="relative flex-1">
          <Users size={16} className="absolute inset-s-3 inset-bs-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={promoteUserId}
            onChange={(e) => setPromoteUserId(e.target.value)}
            placeholder={t('admin.moderators.promotePlaceholder')}
            className="w-full rounded-md border border-border bg-surface py-2 ps-9 pe-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            aria-label={t('admin.moderators.promotePlaceholder')}
          />
        </div>
        <Button type="submit" disabled={!promoteUserId.trim()}>
          {t('admin.moderators.promote')}
        </Button>
      </form>

      <h3 className="text-sm font-semibold text-text-secondary">
        {t('admin.moderators.heading')} ({moderators.length})
      </h3>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="table">
            <thead>
              <tr className="border-be border-border text-start text-text-muted">
                <th className="px-3 py-2">{t('admin.userName')}</th>
                <th className="px-3 py-2">{t('admin.userEmail')}</th>
                <th className="px-3 py-2">{t('admin.moderators.updatedAt')}</th>
                <th className="px-3 py-2">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {moderators.map((m) => (
                <tr key={m.user_id} className="border-be border-border">
                  <td className="px-3 py-2 text-text-primary">{m.display_name}</td>
                  <td className="px-3 py-2 text-text-secondary">{m.email}</td>
                  <td className="px-3 py-2 text-text-secondary">
                    {new Date(m.updated_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {confirmDemoteId === m.user_id ? (
                      <div className="flex gap-1">
                        <Button
                          variant="danger"
                          className="text-xs"
                          onClick={() => void handleDemote(m.user_id)}
                        >
                          {t('common.confirm')}
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-xs"
                          onClick={() => setConfirmDemoteId(null)}
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="danger"
                        className="text-xs"
                        onClick={() => setConfirmDemoteId(m.user_id)}
                      >
                        {t('admin.moderators.demote')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {moderators.length === 0 && (
            <p className="py-8 text-center text-text-muted">{t('admin.moderators.empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  BookOpen,
  Download,
  Zap,
  Users,
  Brain,
  Sparkles,
  MessageCircle,
  Moon,
  Sun,
  Pencil,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  TopBar,
  Card,
  Badge,
  Button,
  Spinner,
  EmptyState,
  Modal,
  Input,
  StoryExportModal,
} from '../components/index.ts';
import { EchoPortrait3D } from '../components/EchoPortrait3D.tsx';
import { useToastStore } from '../stores/useToastStore.ts';
import { useEchoStore } from '../stores/useEchoStore.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { useFeedStore } from '../stores/useFeedStore.ts';
import { echoes as echoApi } from '../lib/api/endpoints.ts';
import { account as accountApi } from '../lib/api/endpoints.ts';
import type {
  EchoRelationship,
  InfluenceBalance,
  EchoMemory,
  FeedItem,
} from '../types/api.ts';

const PAGE_SIZE = 20;

export function EchoDetailPage() {
  const { echoId } = useParams<{ echoId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeEcho, fetchEcho, hibernateEcho, wakeEcho } = useEchoStore();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { personalFeed, fetchPersonalFeed } = useFeedStore();
  const addToast = useToastStore((s) => s.addToast);

  // Local state
  const [relationships, setRelationships] = useState<EchoRelationship[]>([]);
  const [influence, setInfluence] = useState<InfluenceBalance | null>(null);
  const [memories, setMemories] = useState<EchoMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [diaryPage, setDiaryPage] = useState(1);
  const [showAllPersona, setShowAllPersona] = useState(false);

  // Modal state
  const [hibernateModal, setHibernateModal] = useState(false);
  const [influenceModal, setInfluenceModal] = useState(false);
  const [renameModal, setRenameModal] = useState(false);
  const [editPersonaModal, setEditPersonaModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPersona, setNewPersona] = useState('');
  const [influenceType, setInfluenceType] = useState('nudge');
  const [influenceDetails, setInfluenceDetails] = useState('');
  const [exportModal, setExportModal] = useState(false);
  const [soloMode, setSoloMode] = useState(false);

  const loadData = useCallback(async () => {
    if (!echoId) return;
    setIsLoading(true);
    try {
      await fetchEcho(echoId);
      const [rels, inf, mems] = await Promise.all([
        echoApi.relationships(echoId).catch(() => [] as EchoRelationship[]),
        echoApi.influence(echoId).catch(() => null),
        echoApi.memories(echoId).catch(() => [] as EchoMemory[]),
      ]);
      setRelationships(rels);
      setInfluence(inf);
      setMemories(mems);
      await fetchPersonalFeed(echoId);
      // Load solo_mode
      const privacy = await accountApi.getPrivacy().catch(() => ({ solo_mode: false }));
      setSoloMode(privacy.solo_mode);
    } finally {
      setIsLoading(false);
    }
  }, [echoId, fetchEcho, fetchPersonalFeed]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Poll for live updates every 30 seconds (tick counter, mood, diary, events).
  // Debt: replace with WebSocket subscription to /ws/echoes/:id/stream.
  useEffect(() => {
    if (!echoId) return;
    const interval = setInterval(() => {
      void fetchEcho(echoId);
      void fetchPersonalFeed(echoId);
    }, 30_000);
    return () => clearInterval(interval);
  }, [echoId, fetchEcho, fetchPersonalFeed]);

  const diaryEntries = personalFeed.filter((f) => f.item_type === 'diary_entry');
  const lifeEvents = personalFeed.filter((f) => f.item_type === 'life_event');
  const paginatedDiary = diaryEntries.slice(0, diaryPage * PAGE_SIZE);
  const hasMoreDiary = paginatedDiary.length < diaryEntries.length;

  const handleHibernateWake = async () => {
    if (!activeEcho) return;
    try {
      if (activeEcho.status === 'Active') {
        await hibernateEcho(activeEcho.echo_id);
        addToast(t('echoDetail.hibernated'), 'success');
      } else {
        await wakeEcho(activeEcho.echo_id);
        addToast(t('echoDetail.woken'), 'success');
      }
      setHibernateModal(false);
      await fetchEcho(activeEcho.echo_id);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleUseInfluence = async () => {
    if (!activeEcho) return;
    try {
      await echoApi.useInfluence(activeEcho.echo_id, {
        influence_type: influenceType,
        details: influenceDetails || undefined,
      });
      addToast(t('echoDetail.influenceUsed'), 'success');
      setInfluenceModal(false);
      setInfluenceDetails('');
      // Refresh influence balance
      const inf = await echoApi.influence(activeEcho.echo_id).catch(() => null);
      setInfluence(inf);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleRename = async () => {
    if (!activeEcho || !newName.trim()) return;
    try {
      await echoApi.rename(activeEcho.echo_id, newName.trim());
      addToast(t('common.save'), 'success');
      setRenameModal(false);
      await fetchEcho(activeEcho.echo_id);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleEditPersona = async () => {
    if (!activeEcho || !newPersona.trim()) return;
    try {
      await echoApi.updatePersona(activeEcho.echo_id, { persona_text: newPersona.trim() });
      addToast(t('common.save'), 'success');
      setEditPersonaModal(false);
      await fetchEcho(activeEcho.echo_id);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  const handleSoloModeToggle = async () => {
    try {
      await accountApi.updatePrivacy(!soloMode);
      setSoloMode(!soloMode);
    } catch {
      addToast(t('common.error'), 'danger');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col bg-canvas">
        <TopBar
          notificationCount={unreadCount}
          onSearchClick={() => {}}
          onNotificationClick={() => navigate('/notifications')}
          onProfileClick={() => navigate('/settings')}
        />
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!activeEcho) {
    return (
      <div className="flex h-screen flex-col bg-canvas">
        <TopBar
          notificationCount={unreadCount}
          onSearchClick={() => {}}
          onNotificationClick={() => navigate('/notifications')}
          onProfileClick={() => navigate('/settings')}
        />
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            title={t('echoDetail.echoNotFound')}
            description={t('echoDetail.echoNotFoundDesc')}
            action={<Button onClick={() => navigate('/dashboard')}>{t('common.back')}</Button>}
          />
        </div>
      </div>
    );
  }

  const personaTruncated = activeEcho.persona_text.length > 200 && !showAllPersona;

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar
        notificationCount={unreadCount}
        onSearchClick={() => {}}
        onNotificationClick={() => navigate('/notifications')}
        onProfileClick={() => navigate('/settings')}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl p-6">
          {/* Back button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>

          {/* Echo header */}
          <div className="mb-6 flex items-start gap-4">
            <EchoPortrait3D name={activeEcho.name} mood={activeEcho.current_mood} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-text-primary">{activeEcho.name}</h1>
                <Badge variant={activeEcho.status === 'Active' ? 'success' : 'default'}>
                  {activeEcho.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                {t('echoDetail.createdOn', {
                  date: new Date(activeEcho.created_at).toLocaleDateString(),
                })}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {t('dashboard.mood')}: {activeEcho.current_mood} &middot; {t('dashboard.tick', { tick: activeEcho.current_tick })}
              </p>
            </div>
          </div>

          {/* What-if prompt */}
          <Card variant="compact">
            <div className="mb-1 flex items-center gap-2">
              <Sparkles size={16} className="text-accent" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text-primary">{t('echoDetail.whatIf')}</h3>
            </div>
            <p className="text-sm italic text-text-secondary">
              &ldquo;{activeEcho.what_if_prompt}&rdquo;
            </p>
          </Card>

          {/* Persona */}
          <Card variant="compact">
            <div className="mb-1 flex items-center gap-2">
              <Settings size={16} className="text-accent" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-text-primary">{t('echoDetail.persona')}</h3>
            </div>
            <p className="text-sm text-text-secondary">
              {personaTruncated
                ? activeEcho.persona_text.slice(0, 200) + '...'
                : activeEcho.persona_text}
            </p>
            {activeEcho.persona_text.length > 200 && (
              <button
                onClick={() => setShowAllPersona(!showAllPersona)}
                className="mt-1 flex items-center gap-1 text-xs text-accent hover:text-accent/80"
              >
                {showAllPersona ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showAllPersona ? t('common.showLess') : t('common.showMore')}
              </button>
            )}
          </Card>

          {/* Quick Actions */}
          <div className="my-6 flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => navigate(`/echoes/${activeEcho.echo_id}/talk`)}
            >
              <MessageCircle size={16} /> {t('echoDetail.talkToEcho')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setHibernateModal(true);
              }}
            >
              {activeEcho.status === 'Active' ? (
                <>
                  <Moon size={16} /> {t('echoDetail.hibernate')}
                </>
              ) : (
                <>
                  <Sun size={16} /> {t('echoDetail.wake')}
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setInfluenceModal(true)}
            >
              <Zap size={16} /> {t('echoDetail.useInfluence')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setNewName(activeEcho.name);
                setRenameModal(true);
              }}
            >
              <Pencil size={16} /> {t('echoDetail.rename')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setNewPersona(activeEcho.persona_text);
                setEditPersonaModal(true);
              }}
            >
              <Pencil size={16} /> {t('echoDetail.editPersona')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setExportModal(true)}
            >
              <Download size={16} /> {t('echoDetail.exportStory')}
            </Button>
          </div>

          {/* Influence balance */}
          {influence && (
            <div className="mb-6 text-sm text-text-secondary">
              <Zap size={14} className="mr-1 inline text-accent" aria-hidden="true" />
              {t('echoDetail.influenceRemaining', {
                remaining: influence.remaining,
                limit: influence.daily_limit,
              })}
            </div>
          )}

          {/* Diary entries */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">{t('echoDetail.diary')}</h2>
            </div>
            {diaryEntries.length === 0 ? (
              <EmptyState
                title={t('echoDetail.diaryEmpty')}
                description={t('echoDetail.diaryEmptyDesc')}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {paginatedDiary.map((entry) => (
                  <DiaryCard key={entry.item_id} entry={entry} />
                ))}
                {hasMoreDiary && (
                  <Button
                    variant="ghost"
                    onClick={() => setDiaryPage((p) => p + 1)}
                  >
                    {t('common.loadMore')}
                  </Button>
                )}
              </div>
            )}
          </section>

          {/* Life Events */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Zap size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">{t('echoDetail.events')}</h2>
            </div>
            {lifeEvents.length === 0 ? (
              <EmptyState
                title={t('echoDetail.eventsEmpty')}
                description={t('echoDetail.eventsEmptyDesc')}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {lifeEvents.map((event) => (
                  <Card key={event.item_id} variant="compact">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{event.title}</p>
                        <p className="text-sm text-text-secondary">{event.body}</p>
                      </div>
                      <span className="shrink-0 text-xs text-text-muted">
                        {new Date(event.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Relationships */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Users size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('echoDetail.relationships')}
              </h2>
            </div>
            {relationships.length === 0 ? (
              <EmptyState
                title={t('echoDetail.relationshipsEmpty')}
                description={t('echoDetail.relationshipsEmptyDesc')}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {relationships.map((rel) => (
                  <Card key={rel.relationship_id} variant="compact">
                    <p className="text-sm font-medium text-text-primary">
                      {rel.target_echo_name}
                    </p>
                    <p className="text-xs text-text-muted">{rel.relationship_type}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
                      <span>
                        {t('echoDetail.sentiment')}: {(rel.sentiment * 100).toFixed(0)}%
                      </span>
                      <Badge variant={rel.status === 'Active' ? 'success' : 'default'}>
                        {rel.status}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Memories */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Brain size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('echoDetail.memories')}
              </h2>
            </div>
            {memories.length === 0 ? (
              <EmptyState
                title={t('echoDetail.memoriesEmpty')}
                description={t('echoDetail.memoriesEmptyDesc')}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {memories.map((mem) => (
                  <Card key={mem.memory_id} variant="compact">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-text-primary">{mem.content}</p>
                        <p className="text-xs text-text-muted">{mem.memory_type}</p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-text-secondary">
                        <span>{t('echoDetail.strength')}:</span>
                        <div className="h-1.5 w-16 rounded-full bg-surface-raised">
                          <div
                            className="h-1.5 rounded-full bg-accent"
                            style={{ width: `${mem.strength * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Echo Settings */}
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Settings size={18} className="text-accent" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-text-primary">
                {t('echoDetail.settings')}
              </h2>
            </div>
            <Card variant="compact">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={soloMode}
                  onChange={handleSoloModeToggle}
                  className="h-4 w-4 rounded border-border accent-accent"
                />
                <span className="text-sm text-text-primary">
                  {t('echoDetail.soloMode')}
                </span>
              </label>
            </Card>
          </section>
        </div>
      </div>

      {/* Hibernate/Wake Modal */}
      <Modal
        open={hibernateModal}
        onClose={() => setHibernateModal(false)}
        title={activeEcho.status === 'Active' ? t('echoDetail.hibernate') : t('echoDetail.wake')}
      >
        <p className="mb-4 text-sm text-text-secondary">
          {activeEcho.status === 'Active'
            ? t('echoDetail.hibernateConfirm')
            : t('echoDetail.wakeConfirm')}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setHibernateModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleHibernateWake}>{t('common.confirm')}</Button>
        </div>
      </Modal>

      {/* Influence Modal */}
      <Modal
        open={influenceModal}
        onClose={() => setInfluenceModal(false)}
        title={t('echoDetail.useInfluence')}
      >
        <div className="mb-4 flex flex-col gap-3">
          <select
            value={influenceType}
            onChange={(e) => setInfluenceType(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label={t('echoDetail.influenceType')}
          >
            <option value="nudge">{t('echoDetail.influenceNudge')}</option>
            <option value="suggest">{t('echoDetail.influenceSuggest')}</option>
            <option value="inspire">{t('echoDetail.influenceInspire')}</option>
          </select>
          <Input
            label={t('echoDetail.influenceDetailsLabel')}
            value={influenceDetails}
            onChange={(e) => setInfluenceDetails(e.target.value)}
            placeholder={t('echoDetail.influenceDetailsPlaceholder')}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setInfluenceModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleUseInfluence}
            disabled={influence !== null && influence.remaining <= 0}
          >
            {t('echoDetail.useInfluence')}
          </Button>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal
        open={renameModal}
        onClose={() => setRenameModal(false)}
        title={t('echoDetail.rename')}
      >
        <div className="mb-4">
          <Input
            label={t('echoDetail.rename')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRenameModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleRename} disabled={!newName.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </Modal>

      {/* Edit Persona Modal */}
      <Modal
        open={editPersonaModal}
        onClose={() => setEditPersonaModal(false)}
        title={t('echoDetail.editPersona')}
      >
        <div className="mb-4">
          <Input
            multiline
            label={t('echoDetail.persona')}
            value={newPersona}
            onChange={(e) => setNewPersona(e.target.value)}
            maxLength={1000}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditPersonaModal(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleEditPersona} disabled={!newPersona.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </Modal>

      {/* Story Export Modal */}
      <StoryExportModal
        open={exportModal}
        onClose={() => setExportModal(false)}
        echoName={activeEcho.name}
        echoId={activeEcho.echo_id}
      />
    </div>
  );
}

function DiaryCard({ entry }: { entry: FeedItem }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">{entry.title}</p>
          <p className="mt-1 text-sm text-text-secondary">{entry.body}</p>
        </div>
        <span className="ml-3 shrink-0 text-xs text-text-muted">
          {new Date(entry.created_at).toLocaleDateString()}
        </span>
      </div>
    </Card>
  );
}

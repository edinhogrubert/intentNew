import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Calendar, Check, CheckCircle2, Globe2, Heart, LockKeyhole, Plus, RefreshCw, Search, Share2, Sparkles, Tag, ThumbsUp, TrendingUp, UserRound, Users, Vote, X } from 'lucide-react';
import type { UserAccount } from '../types';
import { getSocialProfile, IntentApiError, listSocialFeed, listWatchedIntents, removeIntentReaction, removeIntentSupport, searchIntentsAndUsers, setIntentReaction, supportIntent, unwatchIntent, watchIntent, type ApiIntent, type ApiSearchResults, type ApiSocialProfile, type IntentCategory, type ReactionType, type SearchKind, type SearchPeriod, type SearchStatus, type SocialFeedFilter } from '../services/intentApi';
import { copyToClipboard, getIntentShareUrl } from '../utils/shareLink';
import { APP_VERSION_CONTEXT, APP_VERSION_LABEL } from '../appVersion';

interface MvpHomeFeedProps {
  currentUser: UserAccount;
  onCreate: () => void;
  onSelectIntent: (id: string) => void;
  onSelectProfile: (id: string) => void;
}

const categoryLabels: Record<IntentCategory, string> = {
  SPORTS: 'Esportes',
  ENTERTAINMENT: 'Entretenimento',
  TECHNOLOGY: 'Tecnologia',
  EDUCATION: 'Educação',
  HEALTH_WELLNESS: 'Saúde e bem-estar',
  CAREER_BUSINESS: 'Carreira e negócios',
  COMMUNITY_CAUSES: 'Comunidade e causas',
  PERSONAL_LIFE: 'Vida pessoal',
  OTHER: 'Outros',
};
const categoryEntries = Object.entries(categoryLabels) as Array<[IntentCategory, string]>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function conditionDetails(intent: ApiIntent) {
  if (intent.status === 'REALIZED') {
    return { label: 'Condição cumprida', detail: 'Revelação liberada e disponível no detalhe', progress: 100, icon: CheckCircle2 };
  }
  if (intent.conditionType === 'DATE') {
    return { label: 'Revelação por data', detail: intent.revealAt ? formatDate(intent.revealAt) : 'Data protegida', progress: 0, icon: Calendar };
  }
  if (intent.conditionType === 'GUARDIANS') {
    const approvals = intent.guardianApprovals?.length ?? 0;
    const goal = intent.guardianApprovalGoal ?? 1;
    return { label: 'Confirmação de guardiões', detail: `${approvals} de ${goal} aprovações`, progress: Math.min(100, Math.round((approvals * 100) / goal)), icon: Vote };
  }
  return { label: 'Apoio coletivo', detail: `${intent.supportCount} de ${intent.supportGoal} apoios`, progress: Math.min(100, Math.round((intent.supportCount * 100) / intent.supportGoal)), icon: Users };
}

function IntentCard({ intent, currentUser, onSelectIntent, onSelectProfile }: { intent: ApiIntent; currentUser: UserAccount; onSelectIntent: (id: string) => void; onSelectProfile: (id: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [socialIntent, setSocialIntent] = useState(intent);
  const [actionPending, setActionPending] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');
  const [watchPending, setWatchPending] = useState(false);
  useEffect(() => {
    setCopied(false); setCopyError('');
  }, [intent.id]);
  useEffect(() => {
    setSocialIntent(intent);
    setActionFeedback('');
  }, [intent]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 3000);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const condition = conditionDetails(socialIntent);
  const ConditionIcon = condition.icon;
  const isMine = socialIntent.creator.id === currentUser.id;
  const isRealized = socialIntent.status === 'REALIZED';

  async function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    const url = getIntentShareUrl(intent.id);
    const success = await copyToClipboard(url);
    setCopied(success);
    setCopyError(success ? '' : 'Não foi possível copiar o link.');
  }

  async function handleReaction(type: ReactionType) {
    if (actionPending) return;
    setActionPending(true);
    setActionFeedback('');
    try {
      const result = socialIntent.viewerReaction === type
        ? await removeIntentReaction(socialIntent.id)
        : await setIntentReaction(socialIntent.id, type);
      setSocialIntent((current) => ({ ...current, viewerReaction: result.viewerReaction, reactionCounts: result.reactionCounts }));
      setActionFeedback(result.viewerReaction ? 'Reação registrada. Ela não altera a meta de apoios.' : 'Reação removida.');
    } catch (caught) {
      setActionFeedback(caught instanceof IntentApiError ? caught.message : 'Não foi possível atualizar sua reação.');
    } finally {
      setActionPending(false);
    }
  }

  async function handleSupport() {
    if (actionPending) return;
    setActionPending(true);
    setActionFeedback('');
    try {
      const result = socialIntent.viewerHasSupported
        ? await removeIntentSupport(socialIntent.id)
        : await supportIntent(socialIntent.id);
      setSocialIntent((current) => ({ ...current, supportCount: result.supportCount, viewerHasSupported: result.supported, viewerSupported: result.supported, status: result.realized ? 'REALIZED' : current.status }));
      setActionFeedback(result.realizedNow ? 'Seu apoio realizou esta Intent!' : result.supported ? 'Apoio registrado: ele contribui para a meta.' : 'Apoio retirado.');
    } catch (caught) {
      setActionFeedback(caught instanceof IntentApiError ? caught.message : 'Não foi possível registrar o apoio.');
    } finally {
      setActionPending(false);
    }
  }

  async function handleWatch() {
    if (watchPending) return;
    setWatchPending(true);
    setActionFeedback('');
    try {
      const result = socialIntent.viewerWatching
        ? await unwatchIntent(socialIntent.id)
        : await watchIntent(socialIntent.id);
      setSocialIntent((current) => ({ ...current, viewerWatching: result.watching }));
      setActionFeedback(result.watching ? 'Você está acompanhando esta Intent.' : 'Você deixou de acompanhar esta Intent.');
    } catch (caught) {
      setActionFeedback(caught instanceof IntentApiError ? caught.message : 'Não foi possível atualizar o acompanhamento.');
    } finally {
      setWatchPending(false);
    }
  }

  const visibility = socialIntent.visibility === 'PUBLIC'
    ? { label: 'Pública', className: 'bg-[#e0e0ff] text-[#000666]', icon: Globe2 }
    : socialIntent.visibility === 'FOLLOWERS'
      ? { label: 'Seguidores', className: 'bg-[#e8f5e9] text-[#28642f]', icon: Users }
      : { label: 'Privada', className: 'bg-[#fff3e0] text-[#8a4b08]', icon: LockKeyhole };
  const VisibilityIcon = visibility.icon;

  const totalReactions = socialIntent.reactionCounts?.total ?? (
    (socialIntent.reactionCounts?.LIKE ?? 0) +
    (socialIntent.reactionCounts?.LOVE ?? 0) +
    (socialIntent.reactionCounts?.CELEBRATE ?? 0)
  );

  const viewerReactionLabel = socialIntent.viewerReaction === 'LIKE'
    ? '👍 Você curtiu'
    : socialIntent.viewerReaction === 'LOVE'
      ? '❤️ Você amou'
      : socialIntent.viewerReaction === 'CELEBRATE'
        ? '🎉 Você celebrou'
        : null;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#e4e2de] bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-[#c6c5d4]">
      <div className={`absolute inset-x-0 top-0 h-1 ${isRealized ? 'bg-[#2e7d32]' : 'bg-[#000666]'}`}/>

      {/* Cabeçalho do Card */}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelectProfile(socialIntent.creator.id)}
          className="flex min-w-0 items-center gap-3 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-[#000666]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c6c5d4] bg-[#e0e0ff] font-black text-[#000666]">
            {socialIntent.creator.avatarUrl ? (
              <img src={socialIntent.creator.avatarUrl} alt="" className="h-full w-full object-cover"/>
            ) : (
              socialIntent.creator.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#1b1c1a]">
              {socialIntent.creator.displayName}
              {isMine && <span className="ml-2 rounded-full bg-[#e0e0ff] px-2 py-0.5 text-[10px] text-[#000666]">Você</span>}
            </p>
            <p className="truncate text-xs text-[#666]">
              @{socialIntent.creator.username.replace(/^@+/, '')} · {formatDate(socialIntent.createdAt)}
            </p>
          </div>
        </button>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {isRealized ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5e9] px-2.5 py-1 text-[11px] font-bold text-[#2e7d32]">
              <CheckCircle2 className="h-3 w-3"/>Realizada
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-[#f5f3ef] px-2.5 py-1 text-[11px] font-bold text-[#666]">
              <LockKeyhole className="h-3 w-3 text-[#000666]"/>Em andamento
            </span>
          )}
          <span className="rounded-full bg-[#f0efff] px-2.5 py-1 text-[11px] font-bold text-[#000666]">
            {categoryLabels[socialIntent.category]}
          </span>
          <span className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${visibility.className}`}>
            <VisibilityIcon className="h-3 w-3"/>{visibility.label}
          </span>
        </div>
      </div>

      {/* Título e História */}
      <button
        type="button"
        onClick={() => onSelectIntent(socialIntent.id)}
        className="group mt-4 block w-full text-left focus:outline-none"
      >
        <h3 className="text-lg font-black text-[#1b1c1a] transition-colors group-hover:text-[#000666]">
          {socialIntent.title}
        </h3>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-[#454652]">
          {socialIntent.story}
        </p>
        {socialIntent.recentComments && socialIntent.recentComments.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-[#e4e2de] pt-3 text-sm text-[#454652]">
            {socialIntent.recentComments.map((comment) => (
              <p key={comment.id}><span className="font-semibold text-[#1b1c1a]">{comment.author.displayName}</span> {comment.body}</p>
            ))}
          </div>
        )}
      </button>

      {/* Caixa de Condição e Progresso */}
      <div className="mt-4 rounded-xl border border-[#e8e6e2] bg-[#fbf9f5] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-2">
            <ConditionIcon className={`mt-0.5 h-4 w-4 shrink-0 ${isRealized ? 'text-[#2e7d32]' : 'text-[#000666]'}`}/>
            <div>
              <p className="text-xs font-black text-[#1b1c1a]">{condition.label}</p>
              <p className="mt-0.5 text-xs text-[#666]">{condition.detail}</p>
            </div>
          </div>
          <span className={`text-xs font-black ${isRealized ? 'text-[#2e7d32]' : 'text-[#000666]'}`}>
            {condition.progress}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e4e2de]">
          <div
            className={`h-full transition-all duration-300 ${isRealized ? 'bg-[#2e7d32]' : 'bg-[#006a62]'}`}
            style={{ width: `${condition.progress}%` }}
          />
        </div>
        {!isRealized && socialIntent.conditionType === 'SUPPORT' && (
          <p className="mt-2 text-[11px] font-medium text-[#006a62]">
            {Math.max(0, socialIntent.supportGoal - socialIntent.supportCount) === 0
              ? 'Meta atingida; a realização será confirmada pelo backend.'
              : `Faltam ${socialIntent.supportGoal - socialIntent.supportCount} apoio(s) para a meta.`}
          </p>
        )}
        {!isRealized && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#666]">
            <LockKeyhole className="h-3.5 w-3.5 text-[#777]"/>Conteúdo protegido no cofre até a condição ser cumprida.
          </p>
        )}
      </div>

      {/* Sinais Sociais e Rodapé de Ação */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f0efec] pt-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {totalReactions > 0 ? (
            <div className="flex items-center gap-1.5 rounded-lg bg-[#f5f3ef] px-2.5 py-1 text-xs font-bold text-[#454652]">
              <div className="flex items-center gap-1.5">
                {(socialIntent.reactionCounts?.LIKE ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[#000666]" title={`${socialIntent.reactionCounts?.LIKE} curtidas`}>
                    <ThumbsUp className="h-3 w-3"/>
                    <span>{socialIntent.reactionCounts?.LIKE}</span>
                  </span>
                )}
                {(socialIntent.reactionCounts?.LOVE ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[#c62828]" title={`${socialIntent.reactionCounts?.LOVE} corações`}>
                    <Heart className="h-3 w-3 fill-[#c62828]"/>
                    <span>{socialIntent.reactionCounts?.LOVE}</span>
                  </span>
                )}
                {(socialIntent.reactionCounts?.CELEBRATE ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[#e65100]" title={`${socialIntent.reactionCounts?.CELEBRATE} celebrações`}>
                    <Sparkles className="h-3 w-3"/>
                    <span>{socialIntent.reactionCounts?.CELEBRATE}</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#777]">({totalReactions})</span>
            </div>
          ) : (
            <span className="text-xs text-[#777]">Sem reações ainda</span>
          )}

          {viewerReactionLabel && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e0e0ff] px-2 py-0.5 text-[10px] font-bold text-[#000666]">
              {viewerReactionLabel}
            </span>
          )}

          {socialIntent.viewerHasSupported && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
              <CheckCircle2 className="h-2.5 w-2.5"/>Você apoiou
            </span>
          )}
        </div>

        {!isMine && !isRealized && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Participar desta Intent">
            {socialIntent.viewerReaction && socialIntent.viewerReaction !== 'LIKE' ? (
              <button type="button" onClick={() => onSelectIntent(socialIntent.id)} className="rounded-xl border border-[#e4e2de] px-3 py-2 text-xs font-bold text-[#555] hover:border-[#000666] hover:text-[#000666]">
                Ver reação
              </button>
            ) : (
              <button type="button" disabled={actionPending} onClick={() => void handleReaction('LIKE')} aria-pressed={socialIntent.viewerReaction === 'LIKE'} className="rounded-xl border border-[#e4e2de] px-3 py-2 text-xs font-bold text-[#555] hover:border-[#000666] hover:text-[#000666] disabled:opacity-60">
                <ThumbsUp className="mr-1 inline h-3.5 w-3.5"/>{socialIntent.viewerReaction === 'LIKE' ? 'Remover curtida' : 'Curtir'}
              </button>
            )}
            {socialIntent.conditionType === 'SUPPORT' && (
              <button type="button" disabled={actionPending} onClick={() => void handleSupport()} aria-pressed={Boolean(socialIntent.viewerHasSupported)} className={`rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-60 ${socialIntent.viewerHasSupported ? 'border border-[#2e7d32] bg-[#e8f5e9] text-[#28642f]' : 'bg-[#000666] text-white hover:bg-[#000444]'}`}>
                <Users className="mr-1 inline h-3.5 w-3.5"/>{socialIntent.viewerHasSupported ? 'Apoiado' : 'Apoiar a meta'}
              </button>
            )}
            <button type="button" disabled={watchPending} onClick={() => void handleWatch()} aria-pressed={Boolean(socialIntent.viewerWatching)} className={`rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-60 ${socialIntent.viewerWatching ? 'border-[#006a62] bg-[#e0f2f1] text-[#006a62]' : 'border-[#e4e2de] text-[#555] hover:border-[#006a62] hover:text-[#006a62]'}`}>
              {socialIntent.viewerWatching ? 'Acompanhando' : 'Acompanhar'}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            aria-live="polite"
              title="Copiar link direto para esta Intent"
            className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
              copied
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-[#e4e2de] bg-white text-[#555] hover:border-[#000666] hover:text-[#000666]'
            }`}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600"/> : <Share2 className="h-3.5 w-3.5"/>}
            <span>{copied ? 'Copiado!' : 'Compartilhar'}</span>
              {copyError && <span role="alert">{copyError}</span>}
          </button>

          <button
            type="button"
            onClick={() => onSelectIntent(socialIntent.id)}
            className="flex items-center gap-1.5 rounded-xl bg-[#000666] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#000444]"
          >
            <span>Ver Intent</span>
            <ArrowRight className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>
      {actionFeedback && <p role="status" className="mt-3 text-xs font-medium text-[#28642f]">{actionFeedback}</p>}
    </article>
  );
}

export function MvpHomeFeed({ currentUser, onCreate, onSelectIntent, onSelectProfile }: MvpHomeFeedProps) {
  const [scope, setScope] = useState<SocialFeedFilter>('recent');
  const [showWatched, setShowWatched] = useState(false);
  const [intents, setIntents] = useState<ApiIntent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<ApiSocialProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<IntentCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ApiSearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchingMore, setSearchingMore] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchKind, setSearchKind] = useState<SearchKind>('all');
  const [searchStatus, setSearchStatus] = useState<'all' | SearchStatus>('all');
  const [searchPeriod, setSearchPeriod] = useState<SearchPeriod>('all');
  const [searchNextCursor, setSearchNextCursor] = useState<string | null>(null);
  const loadGeneration = useRef(0);
  const searchGeneration = useRef(0);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setProfileLoading(true);
    void getSocialProfile()
      .then((result) => { if (active) setProfile(result); })
      .catch(() => { if (active) setProfile(null); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [currentUser.id]);

  async function loadFeed(cursor?: string) {
    const generation = ++loadGeneration.current;
    cursor ? setLoadingMore(true) : setLoading(true);
    setError('');
    try {
      const page = showWatched ? await listWatchedIntents(cursor) : await listSocialFeed(scope, cursor);
      if (generation !== loadGeneration.current) return;
      setIntents((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      if (generation === loadGeneration.current) {
        if (caught instanceof IntentApiError) {
          setError(caught.message);
        } else setError('Não foi possível carregar os acontecimentos. Verifique sua conexão e tente novamente.');
      }
    } finally {
      if (generation === loadGeneration.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  useEffect(() => {
    setIntents([]);
    setNextCursor(null);
    setSelectedCategory(null);
    void loadFeed();
    return () => { loadGeneration.current += 1; };
  }, [scope, currentUser.id, showWatched]);

  async function runSearch(kind: SearchKind, status: 'all' | SearchStatus, period: SearchPeriod, cursor?: string) {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError('Digite pelo menos 2 caracteres para buscar.');
      return;
    }
    const generation = cursor ? searchGeneration.current : ++searchGeneration.current;
    cursor ? setSearchingMore(true) : setSearching(true);
    setSearchError('');
    try {
      const page = await searchIntentsAndUsers(query, { kind, status: status === 'all' ? undefined : status, period, cursor });
      if (generation !== searchGeneration.current) return;
      setSearchResults((current) => {
        if (!cursor || !current) return page;
        return kind === 'intents'
          ? { ...page, intents: [...current.intents, ...page.intents] }
          : { ...page, users: [...current.users, ...page.users] };
      });
      setSearchNextCursor(page.nextCursor);
    } catch (caught) {
      if (generation === searchGeneration.current) setSearchError(caught instanceof IntentApiError ? caught.message : 'Não foi possível realizar a busca.');
    } finally {
      if (generation === searchGeneration.current) {
        setSearching(false);
        setSearchingMore(false);
      }
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchResults(null);
    setSearchNextCursor(null);
    void runSearch(searchKind, searchStatus, searchPeriod);
  }

  function changeSearch(kind: SearchKind, status = searchStatus, period = searchPeriod) {
    setSearchKind(kind);
    setSearchStatus(status);
    setSearchPeriod(period);
    setSearchResults(null);
    setSearchNextCursor(null);
    if (searchQuery.trim().length >= 2) void runSearch(kind, status, period);
  }

  function clearSearch() {
    searchGeneration.current += 1;
    setSearchQuery('');
    setSearchResults(null);
    setSearchError('');
    setSearchNextCursor(null);
  }

  const isFollowingFeed = scope === 'supported';
  const visibleIntents = selectedCategory ? intents.filter((intent) => intent.category === selectedCategory) : intents;
  const highlightedIntents = [...intents].sort((left, right) => right.supportCount - left.supportCount).slice(0, 3);
  const profileValue = (value: number | undefined) => profileLoading ? '…' : value ?? '—';

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(208px,260px)_minmax(0,1fr)_minmax(216px,280px)]">
        {/* Sidebar Esquerda (Perfil Resumido & CTA) */}
        <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
          <section className="overflow-hidden rounded-2xl border border-[#e4e2de] bg-white shadow-xs">
            <div className="h-20 bg-gradient-to-r from-[#000666] via-[#3434a5] to-[#8787e8]"/>
            <div className="relative px-5 pb-5 pt-10">
              <button
                type="button"
                onClick={() => onSelectProfile(currentUser.id)}
                className="absolute -top-9 left-5 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#e0e0ff] text-xl font-black text-[#000666]"
                aria-label="Abrir meu perfil"
              >
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className="h-full w-full object-cover"/>
                ) : (
                  currentUser.name.charAt(0).toUpperCase()
                )}
              </button>
              <h2 className="truncate font-black text-[#1b1c1a]">{currentUser.name}</h2>
              <p className="truncate text-xs text-[#666]">@{currentUser.username.replace(/^@+/, '')}</p>
              {currentUser.bio ? (
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[#555]">{currentUser.bio}</p>
              ) : (
                <p className="mt-3 text-xs text-[#777]">Perfil sem biografia.</p>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#f0efec] pt-4 text-center">
                <div>
                  <strong className="block text-sm text-[#000666]">{profileValue(profile?.stats.intentsCreated)}</strong>
                  <span className="text-[10px] text-[#666]">Intents</span>
                </div>
                <div>
                  <strong className="block text-sm text-[#000666]">{profileValue(profile?.stats.followersCount)}</strong>
                  <span className="text-[10px] text-[#666]">Seguidores</span>
                </div>
                <div>
                  <strong className="block text-sm text-[#000666]">{profileValue(profile?.stats.followingCount)}</strong>
                  <span className="text-[10px] text-[#666]">Seguindo</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectProfile(currentUser.id)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f5f3ef] py-2.5 text-xs font-bold text-[#000666] hover:bg-[#e0e0ff] transition-colors"
              >
                <UserRound className="h-4 w-4"/>Ver perfil completo
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-[#000666] p-4 text-white shadow-xs">
            <Sparkles className="h-4 w-4 text-[#c1cfff]"/>
            <h2 className="mt-2 text-sm font-black">Transforme uma intenção em compromisso</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#d8dcff]">
              Defina uma condição real e proteja o conteúdo até ela ser cumprida.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-xs font-black text-[#000666] hover:bg-[#f0efff] transition-colors"
            >
              <Plus className="h-4 w-4"/>Criar Intent
            </button>
          </section>
        </aside>

        {/* Coluna Central do Feed */}
        <main className="min-w-0 space-y-4">
          {/* Caixa de Criação Rápida */}
          <section className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c6c5d4] bg-[#e0e0ff] font-black text-[#000666]">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" className="h-full w-full object-cover"/>
                ) : (
                  currentUser.name.charAt(0).toUpperCase()
                )}
              </div>
              <button
                type="button"
                onClick={onCreate}
                className="flex flex-1 items-center justify-between rounded-full border border-[#d8d6d2] bg-[#fbf9f5] px-4 py-3 text-left text-sm text-[#666] hover:border-[#000666] hover:bg-white transition-colors"
              >
                <span>O que você quer fazer acontecer?</span>
                <span className="hidden items-center gap-1 rounded-full bg-[#000666] px-3 py-1 text-xs font-bold text-white sm:flex">
                  <Plus className="h-3.5 w-3.5"/>Criar
                </span>
              </button>
            </div>
          </section>

          {/* Busca de Intents e Pessoas */}
          <section className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-xs">
            <form onSubmit={(event) => void submitSearch(event)} className="flex gap-2" role="search">
              <label htmlFor="home-search" className="sr-only">Buscar acontecimentos e pessoas</label>
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]"/>
                <input
                  id="home-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar acontecimentos e pessoas..."
                  maxLength={80}
                  className="w-full rounded-xl border border-[#c6c5d4] bg-[#fbf9f5] py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#000666] focus:bg-white"
                />
                {(searchQuery || searchResults) && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    aria-label="Limpar busca"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#666] hover:text-[#1b1c1a]"
                  >
                    <X className="h-4 w-4"/>
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={searching}
                className="rounded-xl bg-[#000666] px-4 py-3 text-sm font-bold text-white disabled:opacity-60 hover:bg-[#000444] transition-colors"
              >
                {searching ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2" aria-label="Tipo de resultado">
              {([['all', 'Tudo'], ['intents', 'Acontecimentos'], ['users', 'Pessoas']] as Array<[SearchKind, string]>).map(([kind, label]) => (
                <button key={kind} type="button" onClick={() => changeSearch(kind)} aria-pressed={searchKind === kind}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${searchKind === kind ? 'bg-[#000666] text-white' : 'bg-[#f5f3ef] text-[#555] hover:bg-[#e0e0ff]'}`}>{label}</button>
              ))}
              {searchKind !== 'users' && <>
                <label className="sr-only" htmlFor="search-status">Status</label>
                <select id="search-status" value={searchStatus} onChange={(event) => changeSearch(searchKind, event.target.value as 'all' | SearchStatus)} className="rounded-full border border-[#d8d6d2] bg-white px-3 py-1.5 text-xs font-bold text-[#555]">
                  <option value="all">Todos os estados</option><option value="PUBLISHED">Em andamento</option><option value="REALIZED">Realizadas</option>
                </select>
                <label className="sr-only" htmlFor="search-period">Período</label>
                <select id="search-period" value={searchPeriod} onChange={(event) => changeSearch(searchKind, searchStatus, event.target.value as SearchPeriod)} className="rounded-full border border-[#d8d6d2] bg-white px-3 py-1.5 text-xs font-bold text-[#555]">
                  <option value="all">Todo período</option><option value="week">Última semana</option><option value="month">Último mês</option>
                </select>
              </>}
            </div>

            {searchError && (
              <div role="alert" className="mt-3 flex gap-2 rounded-xl bg-[#ffdad6] p-3 text-sm text-[#8c1d18]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>
                <span>{searchError}</span>
              </div>
            )}
            {searching && (
              <p className="mt-4 text-center text-sm text-[#666]">Buscando acontecimentos e pessoas...</p>
            )}
            {!searching && searchResults && (
              <div className="mt-4 space-y-5 border-t border-[#e4e2de] pt-4">
                {searchKind === 'all' && (
                  <div className="flex flex-col gap-3 rounded-xl bg-[#f5f3ef] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-relaxed text-[#555]">Prévia dos resultados. Abra uma aba para explorar mais resultados.</p>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => changeSearch('intents')} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#000666] shadow-xs hover:bg-[#e0e0ff]">Ver acontecimentos</button>
                      <button type="button" onClick={() => changeSearch('users')} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#000666] shadow-xs hover:bg-[#e0e0ff]">Ver pessoas</button>
                    </div>
                  </div>
                )}
                {searchResults.intents.length === 0 && searchResults.users.length === 0 && (
                  <p className="py-4 text-center text-sm font-bold text-[#666]">Nenhum resultado encontrado.</p>
                )}
                {searchResults.intents.length > 0 && (
                  <div>
                    <h2 className="mb-2 text-sm font-black text-[#1b1c1a]">{searchKind === 'all' ? 'Prévia de acontecimentos' : 'Acontecimentos'}</h2>
                    <div className="space-y-2">
                      {searchResults.intents.map((intent) => (
                        <button
                          type="button"
                          key={intent.id}
                          onClick={() => onSelectIntent(intent.id)}
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#e4e2de] p-3 text-left hover:border-[#000666] transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#1b1c1a]">{intent.title}</p>
                            <p className="mt-1 truncate text-xs text-[#666]">
                              {intent.creator.displayName} · @{intent.creator.username.replace(/^@+/, '')}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-[#000666]"/>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {searchResults.users.length > 0 && (
                  <div>
                    <h2 className="mb-2 text-sm font-black text-[#1b1c1a]">{searchKind === 'all' ? 'Prévia de pessoas' : 'Pessoas'}</h2>
                    <div className="space-y-2">
                      {searchResults.users.map((user) => (
                        <button
                          type="button"
                          key={user.id}
                          onClick={() => onSelectProfile(user.id)}
                          className="flex w-full items-center gap-3 rounded-xl border border-[#e4e2de] p-3 text-left hover:border-[#000666] transition-colors"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e0e0ff] font-black text-[#000666]">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="h-full w-full object-cover"/>
                            ) : (
                              user.displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[#1b1c1a]">{user.displayName}</p>
                            <p className="truncate text-xs text-[#666]">@{user.username.replace(/^@+/, '')}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {searchNextCursor && searchKind !== 'all' && (
                  <button type="button" disabled={searchingMore} onClick={() => void runSearch(searchKind, searchStatus, searchPeriod, searchNextCursor)} className="w-full rounded-xl border border-[#c6c5d4] py-2.5 text-sm font-bold text-[#000666] hover:bg-[#f5f3ef] disabled:opacity-60">
                    {searchingMore ? 'Carregando mais...' : 'Carregar mais resultados'}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Abas de Navegação do Feed */}
          <section className="flex items-center gap-2 rounded-2xl border border-[#e4e2de] bg-white p-1.5 shadow-xs">
            <div className="flex flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Filtrar acontecimentos">
              {([['recent', 'Recentes'], ['popular', 'Populares'], ['realized', 'Realizadas'], ['supported', 'Apoiadas'], ['mine', 'Minhas']] as Array<[SocialFeedFilter, string]>).map(([filter, label]) => <button key={filter} type="button" role="tab" aria-selected={!showWatched && scope === filter} onClick={() => { setShowWatched(false); setScope(filter); }} className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${!showWatched && scope === filter ? 'bg-[#000666] text-white' : 'text-[#666] hover:bg-[#f5f3ef]'}`}>{label}</button>)}
              <button type="button" role="tab" aria-selected={showWatched} onClick={() => setShowWatched(true)} className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${showWatched ? 'bg-[#000666] text-white' : 'text-[#666] hover:bg-[#f5f3ef]'}`}>Acompanhadas</button>
            </div>
            <button
              type="button"
              onClick={() => void loadFeed()}
              disabled={loading}
              className="rounded-xl border border-[#e4e2de] p-2.5 text-[#666] hover:bg-[#f5f3ef] transition-colors"
              aria-label="Atualizar feed"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>
            </button>
          </section>

          {selectedCategory && (
            <div className="flex items-center justify-between rounded-xl bg-[#e0e0ff] px-4 py-2.5 text-xs font-bold text-[#000666]">
              <span>Filtrando por {categoryLabels[selectedCategory]}</span>
              <button type="button" onClick={() => setSelectedCategory(null)} className="underline hover:text-[#000444]">
                Limpar filtro
              </button>
            </div>
          )}

          {showWatched && !loading && <p className="text-sm font-bold text-[#454652]">Minhas acompanhadas</p>}

          {loading && (
            <div className="rounded-2xl border border-[#e4e2de] bg-white p-10 text-center text-sm text-[#666]">
              Carregando acontecimentos...
            </div>
          )}

          {!loading && error && (
            <div className="flex gap-3 rounded-2xl bg-[#ffdad6] p-5 text-[#8c1d18]">
              <AlertCircle className="h-5 w-5 shrink-0"/>
              <div>
                <p className="font-bold">O feed não pôde ser carregado</p>
                <p className="mt-1 text-sm">{error}</p>
                <button type="button" onClick={() => void loadFeed()} className="mt-3 text-sm font-bold underline">
                  Tentar novamente
                </button>
              </div>
            </div>
          )}

          {!loading && !error && intents.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-[#c6c5d4] bg-white p-8 sm:p-12 text-center">
              <Users className="mx-auto h-8 w-8 text-[#777]"/>
              <h3 className="mt-3 text-base font-black text-[#1b1c1a]">
                {showWatched ? 'Você ainda não acompanha nenhuma Intent.' : isFollowingFeed ? 'Você ainda não tem acontecimentos de pessoas que segue.' : 'Nenhum acontecimento por aqui ainda'}
              </h3>
              <p className="mt-2 text-sm text-[#666] max-w-md mx-auto leading-relaxed">
                {showWatched ? 'Acompanhe uma Intent no feed para encontrá-la aqui.' : isFollowingFeed
                  ? 'Siga perfis para acompanhar o que eles estão fazendo acontecer.'
                  : 'Crie uma nova Intent para definir um acontecimento real com revelação protegida.'}
              </p>
              {showWatched ? (
                <button type="button" onClick={() => setShowWatched(false)} className="mt-5 rounded-xl bg-[#000666] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#000444] transition-colors">Ver feed</button>
              ) : isFollowingFeed ? (
                <button
                  type="button"
                  onClick={() => setScope('recent')}
                  className="mt-5 rounded-xl bg-[#000666] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#000444] transition-colors"
                >
                  Ver todos os acontecimentos
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCreate}
                  className="mt-5 rounded-xl bg-[#000666] px-5 py-3 text-sm font-bold text-white hover:bg-[#000444] transition-colors"
                >
                  Criar primeira Intent
                </button>
              )}
            </div>
          )}

          {!loading && !error && intents.length > 0 && visibleIntents.length === 0 && (
            <div className="rounded-2xl border border-[#e4e2de] bg-white p-8 text-center">
              <Tag className="mx-auto h-6 w-6 text-[#777]"/>
              <p className="mt-2 text-sm font-bold text-[#1b1c1a]">Nenhum acontecimento desta categoria no feed carregado.</p>
              <button type="button" onClick={() => setSelectedCategory(null)} className="mt-3 text-xs font-bold text-[#000666] underline">
                Limpar filtro de categoria
              </button>
            </div>
          )}

          <div className="space-y-4">
            {!loading && !error && visibleIntents.map((intent) => (
              <IntentCard
                key={intent.id}
                intent={intent}
                currentUser={currentUser}
                onSelectIntent={onSelectIntent}
                onSelectProfile={onSelectProfile}
              />
            ))}
          </div>

          {!loading && !error && nextCursor && (
            <button
              type="button"
              onClick={() => void loadFeed(nextCursor)}
              disabled={loadingMore}
              className="w-full rounded-xl border border-[#c6c5d4] bg-white py-3 text-sm font-bold text-[#000666] disabled:opacity-60 hover:bg-[#f5f3ef] transition-colors"
            >
              {loadingMore ? 'Carregando mais...' : 'Carregar mais acontecimentos'}
            </button>
          )}
        </main>

        {/* Sidebar Direita (Destaques & Filtros) */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
          <section className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#000666]"/>
              <h2 className="text-xs font-black uppercase tracking-wider text-[#1b1c1a]">Mais apoiadas no feed</h2>
            </div>
            {highlightedIntents.length > 0 ? (
              <div className="mt-3 divide-y divide-[#f0efec]">
                {highlightedIntents.map((intent) => (
                  <button
                    type="button"
                    key={intent.id}
                    onClick={() => onSelectIntent(intent.id)}
                    className="block w-full py-3 text-left transition-colors group"
                  >
                    <span className="text-[10px] font-bold uppercase text-[#777]">{categoryLabels[intent.category]}</span>
                    <p className="mt-0.5 line-clamp-2 text-xs font-bold text-[#1b1c1a] group-hover:text-[#000666]">{intent.title}</p>
                    <span className="mt-1 block text-[11px] text-[#666]">
                      {intent.supportCount} {intent.supportCount === 1 ? 'apoio' : 'apoios'}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#777]">Nenhum destaque no feed carregado.</p>
            )}
          </section>

          <section className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#000666]"/>
              <h2 className="text-xs font-black uppercase tracking-wider text-[#1b1c1a]">Categorias do MVP</h2>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categoryEntries.map(([category, label]) => (
                <button
                  type="button"
                  key={category}
                  onClick={() => setSelectedCategory((current) => current === category ? null : category)}
                  aria-pressed={selectedCategory === category}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    selectedCategory === category
                      ? 'bg-[#000666] text-white'
                      : 'bg-[#f5f3ef] text-[#555] hover:bg-[#e0e0ff] hover:text-[#000666]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#777]">
              O filtro usa apenas as Intents reais já carregadas neste feed.
            </p>
          </section>

          <section className="rounded-2xl border border-[#e4e2de] bg-[#fbf9f5] p-4">
            <p className="flex items-center gap-2 text-xs font-black text-[#000666]">
              <LockKeyhole className="h-4 w-4"/>Revelação protegida
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-[#666]">
              O conteúdo permanece lacrado até o backend confirmar a condição da Intent.
            </p>
            <span className="mt-3 inline-flex rounded-full bg-[#f0efff] px-2.5 py-1 text-[10px] font-bold text-[#000666]">
              Versão {APP_VERSION_LABEL} · {APP_VERSION_CONTEXT}
            </span>
          </section>
        </aside>
      </div>
    </div>
  );
}

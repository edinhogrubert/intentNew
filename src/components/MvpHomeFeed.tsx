import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight, Calendar, Check, CheckCircle2, Globe2, Heart, LockKeyhole, Plus, RefreshCw, Search, Share2, Sparkles, Tag, ThumbsUp, TrendingUp, UserRound, Users, Vote, X } from 'lucide-react';
import type { UserAccount } from '../types';
import { getSocialProfile, IntentApiError, listPublicIntents, searchIntentsAndUsers, type ApiIntent, type ApiSearchResults, type ApiSocialProfile, type FeedScope, type IntentCategory } from '../services/intentApi';
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
  const condition = conditionDetails(intent);
  const ConditionIcon = condition.icon;
  const isMine = intent.creator.id === currentUser.id;
  const isRealized = intent.status === 'REALIZED';

  async function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    const url = getIntentShareUrl(intent.id);
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  const visibility = intent.visibility === 'PUBLIC'
    ? { label: 'Pública', className: 'bg-[#e0e0ff] text-[#000666]', icon: Globe2 }
    : intent.visibility === 'FOLLOWERS'
      ? { label: 'Seguidores', className: 'bg-[#e8f5e9] text-[#28642f]', icon: Users }
      : { label: 'Privada', className: 'bg-[#fff3e0] text-[#8a4b08]', icon: LockKeyhole };
  const VisibilityIcon = visibility.icon;

  const totalReactions = intent.reactionCounts?.total ?? (
    (intent.reactionCounts?.LIKE ?? 0) +
    (intent.reactionCounts?.LOVE ?? 0) +
    (intent.reactionCounts?.CELEBRATE ?? 0)
  );

  const viewerReactionLabel = intent.viewerReaction === 'LIKE'
    ? '👍 Você curtiu'
    : intent.viewerReaction === 'LOVE'
      ? '❤️ Você amou'
      : intent.viewerReaction === 'CELEBRATE'
        ? '🎉 Você celebrou'
        : null;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[#e4e2de] bg-white p-5 shadow-xs transition-all hover:shadow-md hover:border-[#c6c5d4]">
      <div className={`absolute inset-x-0 top-0 h-1 ${isRealized ? 'bg-[#2e7d32]' : 'bg-[#000666]'}`}/>

      {/* Cabeçalho do Card */}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onSelectProfile(intent.creator.id)}
          className="flex min-w-0 items-center gap-3 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-[#000666]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c6c5d4] bg-[#e0e0ff] font-black text-[#000666]">
            {intent.creator.avatarUrl ? (
              <img src={intent.creator.avatarUrl} alt="" className="h-full w-full object-cover"/>
            ) : (
              intent.creator.displayName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#1b1c1a]">
              {intent.creator.displayName}
              {isMine && <span className="ml-2 rounded-full bg-[#e0e0ff] px-2 py-0.5 text-[10px] text-[#000666]">Você</span>}
            </p>
            <p className="truncate text-xs text-[#666]">
              @{intent.creator.username.replace(/^@+/, '')} · {formatDate(intent.createdAt)}
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
            {categoryLabels[intent.category]}
          </span>
          <span className={`hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${visibility.className}`}>
            <VisibilityIcon className="h-3 w-3"/>{visibility.label}
          </span>
        </div>
      </div>

      {/* Título e História */}
      <button
        type="button"
        onClick={() => onSelectIntent(intent.id)}
        className="group mt-4 block w-full text-left focus:outline-none"
      >
        <h3 className="text-lg font-black text-[#1b1c1a] transition-colors group-hover:text-[#000666]">
          {intent.title}
        </h3>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-[#454652]">
          {intent.story}
        </p>
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
                {(intent.reactionCounts?.LIKE ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[#000666]" title={`${intent.reactionCounts?.LIKE} curtidas`}>
                    <ThumbsUp className="h-3 w-3"/>
                    <span>{intent.reactionCounts?.LIKE}</span>
                  </span>
                )}
                {(intent.reactionCounts?.LOVE ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[#c62828]" title={`${intent.reactionCounts?.LOVE} corações`}>
                    <Heart className="h-3 w-3 fill-[#c62828]"/>
                    <span>{intent.reactionCounts?.LOVE}</span>
                  </span>
                )}
                {(intent.reactionCounts?.CELEBRATE ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 text-[#e65100]" title={`${intent.reactionCounts?.CELEBRATE} celebrações`}>
                    <Sparkles className="h-3 w-3"/>
                    <span>{intent.reactionCounts?.CELEBRATE}</span>
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

          {intent.viewerHasSupported && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f5e9] px-2 py-0.5 text-[10px] font-bold text-[#2e7d32]">
              <CheckCircle2 className="h-2.5 w-2.5"/>Você apoiou
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copiar link direto para esta Intent"
            className={`flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
              copied
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-[#e4e2de] bg-white text-[#555] hover:border-[#000666] hover:text-[#000666]'
            }`}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600"/> : <Share2 className="h-3.5 w-3.5"/>}
            <span>{copied ? 'Copiado!' : 'Compartilhar'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectIntent(intent.id)}
            className="flex items-center gap-1.5 rounded-xl bg-[#000666] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#000444]"
          >
            <span>Ver Intent</span>
            <ArrowRight className="h-3.5 w-3.5"/>
          </button>
        </div>
      </div>
    </article>
  );
}

export function MvpHomeFeed({ currentUser, onCreate, onSelectIntent, onSelectProfile }: MvpHomeFeedProps) {
  const [scope, setScope] = useState<FeedScope>('public');
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
  const [searchError, setSearchError] = useState('');
  const loadGeneration = useRef(0);

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
      const page = await listPublicIntents(scope, cursor);
      if (generation !== loadGeneration.current) return;
      setIntents((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      if (generation === loadGeneration.current) {
        if (caught instanceof IntentApiError) {
          setError(caught.message);
        } else if (scope === 'following') {
          setError('Não foi possível carregar os acontecimentos da sua rede agora.');
        } else {
          setError('Não foi possível carregar os acontecimentos.');
        }
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
  }, [scope]);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchError('Digite pelo menos 2 caracteres para buscar.');
      return;
    }
    setSearching(true);
    setSearchError('');
    setSearchResults(null);
    try {
      setSearchResults(await searchIntentsAndUsers(query));
    } catch (caught) {
      setSearchError(caught instanceof IntentApiError ? caught.message : 'Não foi possível realizar a busca.');
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError('');
  }

  const isFollowingFeed = scope === 'following';
  const visibleIntents = selectedCategory ? intents.filter((intent) => intent.category === selectedCategory) : intents;
  const highlightedIntents = [...intents].sort((left, right) => right.supportCount - left.supportCount).slice(0, 3);
  const profileValue = (value: number | undefined) => profileLoading ? '…' : value ?? '—';

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Sidebar Esquerda (Perfil Resumido & CTA) */}
        <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:col-span-3 lg:block">
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
        <main className="space-y-4 lg:col-span-6">
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
                {searchResults.intents.length === 0 && searchResults.users.length === 0 && (
                  <p className="py-4 text-center text-sm font-bold text-[#666]">Nenhum resultado encontrado.</p>
                )}
                {searchResults.intents.length > 0 && (
                  <div>
                    <h2 className="mb-2 text-sm font-black text-[#1b1c1a]">Acontecimentos</h2>
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
                    <h2 className="mb-2 text-sm font-black text-[#1b1c1a]">Pessoas</h2>
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
              </div>
            )}
          </section>

          {/* Abas de Navegação do Feed */}
          <section className="flex items-center gap-2 rounded-2xl border border-[#e4e2de] bg-white p-1.5 shadow-xs">
            <div className="grid flex-1 grid-cols-2 gap-1" role="tablist" aria-label="Escolher feed">
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'public'}
                onClick={() => setScope('public')}
                className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  scope === 'public' ? 'bg-[#000666] text-white' : 'text-[#666] hover:bg-[#f5f3ef]'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'following'}
                onClick={() => setScope('following')}
                className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  scope === 'following' ? 'bg-[#000666] text-white' : 'text-[#666] hover:bg-[#f5f3ef]'
                }`}
              >
                Seguindo
              </button>
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
                {isFollowingFeed ? 'Você ainda não tem acontecimentos de pessoas que segue.' : 'Nenhum acontecimento por aqui ainda'}
              </h3>
              <p className="mt-2 text-sm text-[#666] max-w-md mx-auto leading-relaxed">
                {isFollowingFeed
                  ? 'Siga perfis para acompanhar o que eles estão fazendo acontecer.'
                  : 'Crie uma nova Intent para definir um acontecimento real com revelação protegida.'}
              </p>
              {isFollowingFeed ? (
                <button
                  type="button"
                  onClick={() => setScope('public')}
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
        <aside className="space-y-4 lg:sticky lg:top-20 lg:col-span-3">
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

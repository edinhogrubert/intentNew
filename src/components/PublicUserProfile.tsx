import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Globe2,
  Heart,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  followUser,
  getPublicUserProfile,
  IntentApiError,
  listProfileFollowers,
  listProfileFollowing,
  unfollowUser,
  type ApiPublicUserProfile,
  type ApiSocialConnection,
} from '../services/intentApi';
import { PublicUserActivity } from './PublicUserActivity';

interface PublicUserProfileProps {
  userId: string;
  onBack: () => void;
  onSelectIntent: (id: string) => void;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatMemberSince(value: string) {
  try {
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return value;
  }
}

export function PublicUserProfile({ userId, onBack, onSelectIntent }: PublicUserProfileProps) {
  const [profile, setProfile] = useState<ApiPublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados da ação de seguir / deixar de seguir
  const [followLoading, setFollowLoading] = useState(false);
  const [followActionError, setFollowActionError] = useState('');
  const [isHoveringFollowing, setIsHoveringFollowing] = useState(false);

  // Estados do modal de seguidores / seguindo
  const [activeModal, setActiveModal] = useState<'followers' | 'following' | null>(null);
  const [modalItems, setModalItems] = useState<ApiSocialConnection[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Aba ativa: 'activity' (Atividade pública) ou 'intents' (Histórico de Intents)
  const [activeTab, setActiveTab] = useState<'activity' | 'intents'>('activity');

  const loadProfile = () => {
    let active = true;
    setLoading(true);
    setError('');
    setProfile(null);
    void getPublicUserProfile(userId)
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof IntentApiError
              ? caught.message
              : 'Não foi possível carregar este perfil agora.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  };

  useEffect(() => {
    const cancel = loadProfile();
    return cancel;
  }, [userId]);

  const handleToggleFollow = async () => {
    if (!profile || profile.isMe || followLoading) return;
    setFollowLoading(true);
    setFollowActionError('');

    const isCurrentlyFollowing = Boolean(profile.viewerIsFollowing);
    // Optimistic update
    setProfile((prev) => {
      if (!prev) return prev;
      const currentFollowers = prev.stats.followersCount ?? 0;
      const newFollowers = isCurrentlyFollowing
        ? Math.max(0, currentFollowers - 1)
        : currentFollowers + 1;
      return {
        ...prev,
        viewerIsFollowing: !isCurrentlyFollowing,
        stats: {
          ...prev.stats,
          followersCount: newFollowers,
        },
      };
    });

    try {
      const updated = isCurrentlyFollowing
        ? await unfollowUser(userId)
        : await followUser(userId);
      setProfile(updated);
    } catch (caught) {
      // Revert optimistic update on failure
      setProfile((prev) => {
        if (!prev) return prev;
        const currentFollowers = prev.stats.followersCount ?? 0;
        const revertedFollowers = isCurrentlyFollowing
          ? currentFollowers + 1
          : Math.max(0, currentFollowers - 1);
        return {
          ...prev,
          viewerIsFollowing: isCurrentlyFollowing,
          stats: {
            ...prev.stats,
            followersCount: revertedFollowers,
          },
        };
      });
      setFollowActionError(
        caught instanceof IntentApiError
          ? caught.message
          : 'Não foi possível atualizar a conexão agora.',
      );
    } finally {
      setFollowLoading(false);
    }
  };

  const handleOpenConnectionsModal = (kind: 'followers' | 'following') => {
    setActiveModal(kind);
    setModalLoading(true);
    setModalError('');
    setModalItems([]);
    const fetcher = kind === 'followers' ? listProfileFollowers : listProfileFollowing;
    fetcher(userId)
      .then((res) => {
        setModalItems(res.items);
      })
      .catch((err) => {
        setModalError(
          err instanceof IntentApiError
            ? err.message
            : 'Não foi possível carregar a lista de conexões.',
        );
      })
      .finally(() => {
        setModalLoading(false);
      });
  };

  const followersCount = profile?.stats.followersCount ?? 0;
  const followingCount = profile?.stats.followingCount ?? 0;

  return (
    <section className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Botão de navegação para voltar */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-[#000666] hover:bg-[#e0e0ff]/60 transition-colors mb-6 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar ao início</span>
      </button>

      {/* Estado de Carregamento (Skeleton + Spinner) */}
      {loading && (
        <div role="status" aria-label="Carregando perfil público" className="space-y-6">
          <div className="rounded-3xl border border-[#e4e2de] bg-white p-6 sm:p-8 animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-slate-200 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-slate-200 rounded-md w-1/3" />
                <div className="h-4 bg-slate-200 rounded-md w-1/4" />
              </div>
            </div>
            <div className="h-4 bg-slate-200 rounded-md w-1/2" />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-20 bg-slate-100 rounded-2xl" />
              ))}
            </div>
          </div>
          <p className="text-center text-sm font-medium text-[#666] flex items-center justify-center gap-2 py-4">
            <LoaderCircle className="w-5 h-5 animate-spin text-[#000666]" />
            Carregando perfil público...
          </p>
        </div>
      )}

      {/* Estado de Erro */}
      {error && !loading && (
        <div
          role="alert"
          className="rounded-3xl border border-[#ffb4ab] bg-[#fff8f7] p-6 sm:p-8 text-center space-y-4 max-w-lg mx-auto"
        >
          <div className="w-12 h-12 rounded-full bg-[#ffdad6] text-[#8c1d18] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-extrabold text-lg text-[#3b0907]">Não foi possível carregar o perfil</h2>
            <p className="text-sm text-[#772b27] mt-1">{error}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={loadProfile}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#000666] text-white text-sm font-bold min-h-[44px] hover:bg-[#1b237b] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar novamente</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-[#e4e2de] text-sm font-bold text-[#444] min-h-[44px] hover:bg-white transition-colors"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      )}

      {/* Perfil Carregado com Sucesso */}
      {!loading && profile && (
        <div className="space-y-8">
          {/* Alerta de erro de ação (Follow / Unfollow) */}
          {followActionError && (
            <div className="rounded-2xl border border-[#ffb4ab] bg-[#fff8f7] px-4 py-3 text-sm text-[#8c1d18] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{followActionError}</span>
              </span>
              <button
                type="button"
                onClick={() => setFollowActionError('')}
                className="text-xs font-bold hover:underline"
              >
                Fechar
              </button>
            </div>
          )}

          {/* Parte 1 — Cabeçalho do perfil */}
          <header className="rounded-3xl border border-[#e4e2de] bg-white overflow-hidden shadow-sm">
            {/* Faixa decorativa superior com identidade visual do Intent */}
            <div className="h-24 sm:h-32 bg-gradient-to-r from-[#000666] via-[#1b237b] to-[#2d3596] relative px-6 py-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                {profile.viewerIsFollowing && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/90 backdrop-blur-md text-white border border-emerald-400/40">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Você acompanha este perfil</span>
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-white border border-white/30">
                <Globe2 className="w-3.5 h-3.5" />
                <span>Perfil Social</span>
              </span>
            </div>

            <div className="px-6 pb-6 pt-0 sm:px-8 sm:pb-8 relative">
              {/* Avatar, Informações Básicas e Botão Social de Seguir */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-14 mb-4">
                <div className="flex items-end gap-4">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#e0e0ff] border-4 border-white shadow-md overflow-hidden flex items-center justify-center text-3xl font-black text-[#000666] shrink-0">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt={`Foto de perfil de ${profile.displayName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      profile.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="mb-1">
                    <h1 className="text-2xl sm:text-3xl font-black text-[#1b1c1a] tracking-tight">
                      {profile.displayName}
                    </h1>
                    <p className="text-sm font-semibold text-[#666]">@{profile.username}</p>
                  </div>
                </div>

                {/* Ação Social de Seguir / Deixar de Seguir ou Badge "Seu Perfil" */}
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  {profile.isMe ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#f7f6fc] text-[#000666] border border-[#e4e2de]">
                      <UserCheck className="w-4 h-4 text-[#000666]" />
                      <span>Seu Perfil</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      disabled={followLoading}
                      onMouseEnter={() => setIsHoveringFollowing(true)}
                      onMouseLeave={() => setIsHoveringFollowing(false)}
                      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold min-h-[44px] transition-all shadow-sm ${
                        profile.viewerIsFollowing
                          ? isHoveringFollowing
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                          : 'bg-[#000666] text-white hover:bg-[#1b237b] border border-transparent'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {followLoading ? (
                        <>
                          <LoaderCircle className="w-4 h-4 animate-spin" />
                          <span>Processando...</span>
                        </>
                      ) : profile.viewerIsFollowing ? (
                        isHoveringFollowing ? (
                          <>
                            <UserMinus className="w-4 h-4 text-rose-600" />
                            <span>Deixar de seguir</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>Seguindo</span>
                          </>
                        )
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Seguir perfil</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Informações de Membro e Contadores de Rede Social */}
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <button
                  type="button"
                  onClick={() => handleOpenConnectionsModal('followers')}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#333] bg-[#f7f6fc] hover:bg-[#e0e0ff]/60 px-3.5 py-2 rounded-xl border border-[#e4e2de] transition-colors"
                >
                  <Users className="w-4 h-4 text-[#000666]" />
                  <span>
                    <strong className="font-black text-[#000666]">{followersCount}</strong>{' '}
                    {followersCount === 1 ? 'Seguidor' : 'Seguidores'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenConnectionsModal('following')}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#333] bg-[#f7f6fc] hover:bg-[#e0e0ff]/60 px-3.5 py-2 rounded-xl border border-[#e4e2de] transition-colors"
                >
                  <UserCheck className="w-4 h-4 text-[#000666]" />
                  <span>
                    <strong className="font-black text-[#000666]">{followingCount}</strong> Seguindo
                  </span>
                </button>

                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#555] bg-[#f7f6fc] px-3.5 py-2 rounded-xl border border-[#e4e2de]">
                  <Calendar className="w-4 h-4 text-[#000666]" />
                  <span>Membro desde {formatMemberSince(profile.createdAt)}</span>
                </div>
              </div>

              {/* Tagline / Frase curta sobre o histórico no Intent */}
              <div className="mt-4 pt-4 border-t border-[#f0eee9]">
                <p className="text-xs font-bold uppercase tracking-wider text-[#000666]">
                  Constrói acontecimentos no Intent
                </p>
                <p className="text-sm text-[#555] mt-0.5">
                  Acompanhe o que este perfil está fazendo acontecer no seu histórico público.
                </p>
              </div>

              {/* Bio do Usuário (se houver) */}
              {profile.bio && (
                <div className="mt-4 p-4 rounded-2xl bg-[#f7f6fc] border border-[#e4e2de]">
                  <p className="text-sm text-[#333] whitespace-pre-wrap break-words leading-relaxed">
                    {profile.bio}
                  </p>
                </div>
              )}
            </div>
          </header>

          {/* Parte 2 — Identidade Social: Conexões, Criador e Participante */}
          <section aria-labelledby="social-identity-heading" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="social-identity-heading" className="text-xl font-black text-[#1b1c1a]">
                  Identidade Social
                </h2>
                <p className="text-xs text-[#666]">
                  Acontecimentos criados, participação ativa e conexões na rede
                </p>
              </div>
            </div>

            {/* Bloco 1: Conexões */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#000666]" />
                <h3 className="text-xs font-black text-[#1b1c1a] uppercase tracking-wider">
                  Conexões
                </h3>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                {/* Card 1: Seguidores */}
                <div
                  onClick={() => handleOpenConnectionsModal('followers')}
                  className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-[#000666]/30 transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Seguidores</span>
                    <Users className="w-4 h-4 text-[#000666] group-hover:scale-110 transition-transform" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-[#000666]">{followersCount}</span>
                    <p className="text-[11px] text-[#777] leading-tight">Pessoas que acompanham.</p>
                  </dd>
                </div>

                {/* Card 2: Seguindo */}
                <div
                  onClick={() => handleOpenConnectionsModal('following')}
                  className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-[#000666]/30 transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Seguindo</span>
                    <UserCheck className="w-4 h-4 text-[#000666] group-hover:scale-110 transition-transform" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-[#000666]">{followingCount}</span>
                    <p className="text-[11px] text-[#777] leading-tight">Perfis acompanhados.</p>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Bloco 2: Como criador */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#000666]" />
                <h3 className="text-xs font-black text-[#1b1c1a] uppercase tracking-wider">
                  Como criador
                </h3>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Card 1: Intents públicas */}
                <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-[#000666]/30 transition-all flex flex-col justify-between">
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Intents públicas</span>
                    <Globe2 className="w-4 h-4 text-[#000666]" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-[#000666]">
                      {profile.stats.publicIntentsCount}
                    </span>
                    <p className="text-[11px] text-[#777] leading-tight">Acontecimentos públicos.</p>
                  </dd>
                </div>

                {/* Card 2: Realizações */}
                <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Realizações</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-emerald-700">
                      {profile.stats.intentsRealized}
                    </span>
                    <p className="text-[11px] text-[#777] leading-tight">Intents concluídas.</p>
                  </dd>
                </div>

                {/* Card 3: Apoios recebidos */}
                <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-rose-500/30 transition-all flex flex-col justify-between">
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Apoios recebidos</span>
                    <Heart className="w-4 h-4 text-rose-500" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-rose-600">
                      {profile.stats.totalSupportReceived}
                    </span>
                    <p className="text-[11px] text-[#777] leading-tight">Pessoas mobilizadas.</p>
                  </dd>
                </div>

                {/* Card 4: Reações recebidas */}
                <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-amber-500/30 transition-all flex flex-col justify-between">
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Reações recebidas</span>
                    <ThumbsUp className="w-4 h-4 text-amber-500" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-amber-600">
                      {profile.stats.totalReactionsReceived}
                    </span>
                    <p className="text-[11px] text-[#777] leading-tight">Interações no histórico.</p>
                  </dd>
                </div>

                {/* Card 5: Comentários recebidos */}
                <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Comentários recebidos</span>
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-indigo-700">
                      {profile.stats.totalCommentsReceived}
                    </span>
                    <p className="text-[11px] text-[#777] leading-tight">Comentários no histórico.</p>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Bloco 3: Como participante */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#000666]" />
                <h3 className="text-xs font-black text-[#1b1c1a] uppercase tracking-wider">
                  Como participante
                </h3>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Card 1: Intents apoiadas */}
                <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-rose-500/30 transition-all flex flex-col justify-between">
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Intents apoiadas</span>
                    <Heart className="w-4 h-4 text-rose-500" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-rose-600">
                      {profile.stats.supportedIntentsCount ?? 0}
                    </span>
                    <p className="text-[11px] text-[#777] leading-tight">Apoios ativos mantidos.</p>
                  </dd>
                </div>

                {/* Card 2: Reações dadas */}
                <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-amber-500/30 transition-all flex flex-col justify-between">
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Reações dadas</span>
                    <ThumbsUp className="w-4 h-4 text-amber-500" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-amber-600">
                      {profile.stats.reactionsGivenCount ?? 0}
                    </span>
                    <p className="text-[11px] text-[#777] leading-tight">Reações manifestadas.</p>
                  </dd>
                </div>

                {/* Card 3: Comentários feitos */}
                <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Comentários feitos</span>
                    <MessageSquare className="w-4 h-4 text-indigo-600" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-indigo-700">
                      {profile.stats.commentsGivenCount ?? 0}
                    </span>
                    <p className="text-[11px] text-[#777] leading-tight">Participação em diálogos.</p>
                  </dd>
                </div>

                {/* Card 4: Participações realizadas */}
                <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                  <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                    <span>Participações realizadas</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </dt>
                  <dd className="space-y-1">
                    <span className="text-2xl font-black text-emerald-700">
                      {profile.stats.realizedParticipationsCount ?? 0}
                    </span>
                    <p className="text-[11px] text-[#777] leading-tight">Intents concluídas com você.</p>
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {/* Parte 3 — Resumo Social do Perfil */}
          <section className="rounded-2xl border border-[#e4e2de] bg-gradient-to-br from-white to-[#f7f6fc] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-[#000666]" />
              <h2 className="font-extrabold text-base text-[#1b1c1a]">Identidade Social no Intent</h2>
            </div>
            <p className="text-sm text-[#444] leading-relaxed">
              Este perfil cria acontecimentos e também participa da realização de Intents de outras pessoas.
              {profile.stats.publicIntentsCount > 0 ? (
                <>
                  {' '}Como criador, publicou{' '}
                  <strong className="font-extrabold text-[#000666]">
                    {profile.stats.publicIntentsCount}{' '}
                    {profile.stats.publicIntentsCount === 1 ? 'Intent pública' : 'Intents públicas'}
                  </strong>
                  , alcançou{' '}
                  <strong className="font-extrabold text-emerald-700">
                    {profile.stats.intentsRealized}{' '}
                    {profile.stats.intentsRealized === 1 ? 'realização' : 'realizações'}
                  </strong>{' '}
                  e mobilizou{' '}
                  <strong className="font-extrabold text-rose-600">
                    {profile.stats.totalSupportReceived}{' '}
                    {profile.stats.totalSupportReceived === 1 ? 'apoio' : 'apoios'}
                  </strong>{' '}
                  de pessoas que acompanham.
                </>
              ) : null}
              {((profile.stats.supportedIntentsCount ?? 0) > 0 || (profile.stats.realizedParticipationsCount ?? 0) > 0) ? (
                <>
                  {' '}Como participante, apoia ativamente{' '}
                  <strong className="font-extrabold text-rose-600">
                    {profile.stats.supportedIntentsCount ?? 0}{' '}
                    {(profile.stats.supportedIntentsCount ?? 0) === 1 ? 'acontecimento' : 'acontecimentos'}
                  </strong>{' '}
                  e esteve presente em{' '}
                  <strong className="font-extrabold text-emerald-700">
                    {profile.stats.realizedParticipationsCount ?? 0}{' '}
                    {(profile.stats.realizedParticipationsCount ?? 0) === 1 ? 'realização concluída' : 'realizações concluídas'}
                  </strong>.
                </>
              ) : null}
            </p>

            {/* Chips de Engajamento Calculados */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#e4e2de]/60">
              {profile.stats.publicIntentsCount > 0 && (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {Math.round(
                        (profile.stats.intentsRealized / profile.stats.publicIntentsCount) * 100,
                      )}
                      % de realizações como criador
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#e0e0ff] text-[#000666] border border-[#c4c4ff]">
                    <Heart className="w-3.5 h-3.5" />
                    <span>
                      {(
                        profile.stats.totalSupportReceived / profile.stats.publicIntentsCount
                      ).toFixed(1)}{' '}
                      apoios / Intent em média
                    </span>
                  </span>
                </>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Users className="w-3.5 h-3.5" />
                <span>Participação ativa na rede</span>
              </span>
            </div>
          </section>

          {/* Parte 4 — Navegação de Abas: Atividade Pública vs Histórico de Intents */}
          <div className="space-y-6 pt-2">
            {/* Seletor de Abas */}
            <div className="flex items-center gap-2 border-b border-[#e4e2de] pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('activity')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                  activeTab === 'activity'
                    ? 'bg-[#000666] text-white shadow-sm'
                    : 'bg-[#f7f6fc] text-[#555] hover:bg-[#e0e0ff]/60 hover:text-[#000666]'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Atividade pública</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('intents')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                  activeTab === 'intents'
                    ? 'bg-[#000666] text-white shadow-sm'
                    : 'bg-[#f7f6fc] text-[#555] hover:bg-[#e0e0ff]/60 hover:text-[#000666]'
                }`}
              >
                <Globe2 className="w-4 h-4" />
                <span>Histórico de Intents</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    activeTab === 'intents'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#e0e0ff] text-[#000666]'
                  }`}
                >
                  {profile.intents.length}
                </span>
              </button>
            </div>

            {/* Conteúdo da Aba Ativa */}
            {activeTab === 'activity' ? (
              <PublicUserActivity
                userId={userId}
                displayName={profile.displayName}
                onSelectIntent={onSelectIntent}
              />
            ) : (
              <section aria-labelledby="public-intents-heading" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 id="public-intents-heading" className="text-xl font-black text-[#1b1c1a] flex items-center gap-2">
                      <span>Histórico de Intents Criadas</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#000666] text-white font-bold">
                        {profile.intents.length}
                      </span>
                    </h2>
                    <p className="text-xs text-[#666]">
                      Acontecimentos e promessas públicas registradas por @{profile.username}
                    </p>
                  </div>
                </div>

                {/* Estado Vazio de Intents */}
                {profile.intents.length === 0 && (
                  <div className="rounded-3xl border border-[#e4e2de] bg-white p-8 sm:p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#f7f6fc] text-[#000666] flex items-center justify-center mx-auto">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <h3 className="font-extrabold text-base text-[#1b1c1a]">
                      Este perfil ainda não possui Intents públicas
                    </h3>
                    <p className="text-sm text-[#666] max-w-md mx-auto">
                      Quando novas Intents forem publicadas no modo público, elas aparecerão listadas no seu histórico.
                    </p>
                  </div>
                )}

                {/* Lista de Cards de Intents */}
                <div className="grid grid-cols-1 gap-4">
                  {profile.intents.map((intent) => {
                    const isRealized = intent.status === 'REALIZED';
                    return (
                      <article
                        key={intent.id}
                        className="rounded-2xl border border-[#e4e2de] bg-white p-5 sm:p-6 shadow-sm hover:border-[#000666]/30 transition-all space-y-3"
                      >
                        {/* Cabeçalho do Card (Status e Meta) */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0eee9] pb-3">
                          <div className="flex items-center gap-2">
                            {isRealized ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Realizada</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Em andamento</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs font-semibold text-[#666]">
                            <span className="flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100">
                              <Heart className="w-3.5 h-3.5" />
                              <span>
                                {intent.supportCount}{' '}
                                {intent.supportCount === 1 ? 'apoio' : 'apoios'}
                              </span>
                            </span>
                            <span className="flex items-center gap-1 text-[#666]">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>{formatDate(intent.createdAt)}</span>
                            </span>
                          </div>
                        </div>

                        {/* Conteúdo Principal */}
                        <div>
                          <h3 className="text-lg font-black text-[#1b1c1a] break-words">
                            {intent.title}
                          </h3>
                          <p className="text-sm text-[#555] mt-2 whitespace-pre-wrap break-words line-clamp-3 leading-relaxed">
                            {intent.story}
                          </p>
                        </div>

                        {/* Ação de Abertura */}
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => onSelectIntent(intent.id)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#f7f6fc] text-[#000666] text-sm font-bold hover:bg-[#e0e0ff] transition-colors min-h-[44px]"
                          >
                            <span>Abrir Intent</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Modal de Conexões (Seguidores / Seguindo) */}
          {activeModal && (
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="connections-modal-title"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
            >
              <div className="bg-white rounded-3xl border border-[#e4e2de] max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Cabeçalho do Modal */}
                <div className="px-6 py-4 border-b border-[#e4e2de] flex items-center justify-between bg-[#f7f6fc]">
                  <div className="flex items-center gap-2">
                    {activeModal === 'followers' ? (
                      <Users className="w-5 h-5 text-[#000666]" />
                    ) : (
                      <UserCheck className="w-5 h-5 text-[#000666]" />
                    )}
                    <h3 id="connections-modal-title" className="font-extrabold text-lg text-[#1b1c1a]">
                      {activeModal === 'followers' ? 'Seguidores' : 'Seguindo'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    aria-label="Fechar modal"
                    className="p-2 rounded-full hover:bg-slate-200 text-[#555] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Conteúdo do Modal */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  {modalLoading && (
                    <div className="py-8 text-center space-y-3">
                      <LoaderCircle className="w-6 h-6 animate-spin text-[#000666] mx-auto" />
                      <p className="text-sm font-medium text-[#666]">Carregando conexões...</p>
                    </div>
                  )}

                  {modalError && !modalLoading && (
                    <div className="p-4 rounded-2xl bg-[#fff8f7] border border-[#ffb4ab] text-center text-sm text-[#8c1d18]">
                      {modalError}
                    </div>
                  )}

                  {!modalLoading && !modalError && modalItems.length === 0 && (
                    <div className="py-8 text-center space-y-2">
                      <p className="font-bold text-[#333]">Nenhuma conexão encontrada</p>
                      <p className="text-xs text-[#666]">
                        {activeModal === 'followers'
                          ? 'Este perfil ainda não possui seguidores registrados.'
                          : 'Este perfil ainda não está seguindo outros usuários.'}
                      </p>
                    </div>
                  )}

                  {!modalLoading &&
                    !modalError &&
                    modalItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-[#f0eee9] bg-white hover:border-[#000666]/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#e0e0ff] overflow-hidden flex items-center justify-center font-bold text-[#000666] shrink-0">
                            {item.avatarUrl ? (
                              <img
                                src={item.avatarUrl}
                                alt={item.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              item.displayName.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-extrabold text-sm text-[#1b1c1a]">{item.displayName}</p>
                            <p className="text-xs text-[#666]">@{item.username}</p>
                          </div>
                        </div>

                        {item.isMe ? (
                          <span className="text-xs font-bold text-[#888] bg-slate-100 px-2.5 py-1 rounded-lg">
                            Você
                          </span>
                        ) : item.isFollowing ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            <Check className="w-3 h-3" />
                            <span>Seguindo</span>
                          </span>
                        ) : null}
                      </div>
                    ))}
                </div>

                {/* Rodapé do Modal */}
                <div className="px-6 py-3 border-t border-[#e4e2de] bg-[#f7f6fc] text-right">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-4 py-2 rounded-xl bg-[#000666] text-white text-xs font-bold hover:bg-[#1b237b] transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
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
} from 'lucide-react';
import { getPublicUserProfile, IntentApiError, type ApiPublicUserProfile } from '../services/intentApi';

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
          {/* Parte 1 — Cabeçalho do perfil */}
          <header className="rounded-3xl border border-[#e4e2de] bg-white overflow-hidden shadow-sm">
            {/* Faixa decorativa superior com identidade visual do Intent */}
            <div className="h-24 sm:h-32 bg-gradient-to-r from-[#000666] via-[#1b237b] to-[#2d3596] relative px-6 py-4 flex items-start justify-end">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-white border border-white/30">
                <Globe2 className="w-3.5 h-3.5" />
                <span>Perfil Público</span>
              </span>
            </div>

            <div className="px-6 pb-6 pt-0 sm:px-8 sm:pb-8 relative">
              {/* Avatar e Informações Básicas */}
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

                <div className="flex items-center gap-2 text-xs font-semibold text-[#555] bg-[#f7f6fc] px-3.5 py-2 rounded-xl border border-[#e4e2de] self-start sm:self-auto">
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

          {/* Parte 2 — Cards de Reputação Social */}
          <section aria-labelledby="reputation-stats-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="reputation-stats-heading" className="text-lg font-black text-[#1b1c1a]">
                  Estatísticas Sociais
                </h2>
                <p className="text-xs text-[#666]">
                  Histórico público de acontecimentos e engajamento da comunidade
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
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
                  <p className="text-[11px] text-[#777] leading-tight">
                    Acontecimentos públicos deste perfil.
                  </p>
                </dd>
              </div>

              {/* Card 2: Realizações */}
              <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                  <span>Realizações</span>
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </dt>
                <dd className="space-y-1">
                  <span className="text-2xl font-black text-emerald-700">
                    {profile.stats.intentsRealized}
                  </span>
                  <p className="text-[11px] text-[#777] leading-tight">
                    Intents que chegaram à realização.
                  </p>
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
                  <p className="text-[11px] text-[#777] leading-tight">
                    Pessoas que apoiaram este perfil.
                  </p>
                </dd>
              </div>

              {/* Card 4: Reações recebidas */}
              <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-amber-500/30 transition-all flex flex-col justify-between">
                <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                  <span>Reações</span>
                  <ThumbsUp className="w-4 h-4 text-amber-500" />
                </dt>
                <dd className="space-y-1">
                  <span className="text-2xl font-black text-amber-600">
                    {profile.stats.totalReactionsReceived}
                  </span>
                  <p className="text-[11px] text-[#777] leading-tight">
                    Interações recebidas no histórico.
                  </p>
                </dd>
              </div>

              {/* Card 5: Comentários */}
              <div className="rounded-2xl border border-[#e4e2de] bg-white p-4 shadow-sm hover:border-indigo-500/30 transition-all col-span-2 sm:col-span-1 flex flex-col justify-between">
                <dt className="flex items-center justify-between text-xs font-bold text-[#666] mb-2">
                  <span>Comentários</span>
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                </dt>
                <dd className="space-y-1">
                  <span className="text-2xl font-black text-indigo-700">
                    {profile.stats.totalCommentsReceived}
                  </span>
                  <p className="text-[11px] text-[#777] leading-tight">
                    Participações em conversas.
                  </p>
                </dd>
              </div>
            </dl>
          </section>

          {/* Parte 3 — Resumo Social do Perfil */}
          <section className="rounded-2xl border border-[#e4e2de] bg-gradient-to-br from-white to-[#f7f6fc] p-5 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-[#000666]" />
              <h2 className="font-extrabold text-base text-[#1b1c1a]">Resumo da Trajetória</h2>
            </div>
            <p className="text-sm text-[#444] leading-relaxed">
              {profile.stats.publicIntentsCount > 0 ? (
                <>
                  Este perfil publicou{' '}
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
                  da comunidade no Intent.
                </>
              ) : (
                'Este perfil está construindo seu histórico público no Intent e ainda não possui publicações públicas registradas.'
              )}
            </p>

            {/* Chips de Engajamento Calculados */}
            {profile.stats.publicIntentsCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#e4e2de]/60">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {Math.round(
                      (profile.stats.intentsRealized / profile.stats.publicIntentsCount) * 100,
                    )}
                    % de realizações
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
              </div>
            )}
          </section>

          {/* Parte 4 — Histórico Público de Intents */}
          <section aria-labelledby="public-intents-heading" className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="public-intents-heading" className="text-xl font-black text-[#1b1c1a] flex items-center gap-2">
                  <span>Histórico Público</span>
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
        </div>
      )}
    </section>
  );
}


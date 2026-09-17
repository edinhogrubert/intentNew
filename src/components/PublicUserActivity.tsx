import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Heart,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsUp,
} from 'lucide-react';
import {
  listUserPublicActivity,
  IntentApiError,
  type ApiPublicActivityItem,
} from '../services/intentApi';

interface PublicUserActivityProps {
  userId: string;
  displayName: string;
  onSelectIntent: (intentId: string) => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Agora mesmo';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `Há ${diffInMinutes} ${diffInMinutes === 1 ? 'minuto' : 'minutos'}`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `Há ${diffInHours} ${diffInHours === 1 ? 'hora' : 'horas'}`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Ontem';
    if (diffInDays < 30) return `Há ${diffInDays} dias`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `Há ${diffInMonths} ${diffInMonths === 1 ? 'mês' : 'meses'}`;

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
}

function formatFullDate(dateString: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

export function PublicUserActivity({ userId, displayName, onSelectIntent }: PublicUserActivityProps) {
  const [items, setItems] = useState<ApiPublicActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadInitialActivity = () => {
    let active = true;
    setLoading(true);
    setError('');
    setItems([]);
    setNextCursor(null);

    listUserPublicActivity(userId, undefined, 15)
      .then((res) => {
        if (active) {
          setItems(res.items);
          setNextCursor(res.nextCursor);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            caught instanceof IntentApiError
              ? caught.message
              : 'Não foi possível carregar a atividade pública deste perfil.',
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
    const cancel = loadInitialActivity();
    return cancel;
  }, [userId]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const res = await listUserPublicActivity(userId, nextCursor, 15);
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (caught) {
      setError(
        caught instanceof IntentApiError
          ? caught.message
          : 'Não foi possível carregar mais atividades.',
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const getEventDetails = (item: ApiPublicActivityItem) => {
    switch (item.type) {
      case 'INTENT_CREATED':
        return {
          icon: <Sparkles className="w-4 h-4 text-[#000666]" />,
          badgeBg: 'bg-[#e0e0ff] text-[#000666] border-[#c4c4ff]',
          titleText: `${displayName} criou uma Intent`,
          actionVerb: 'Criação de Intent',
        };
      case 'INTENT_SUPPORTED':
        return {
          icon: <Heart className="w-4 h-4 text-rose-600" />,
          badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
          titleText: `${displayName} apoiou uma Intent`,
          actionVerb: 'Apoio manifestado',
        };
      case 'INTENT_REALIZED_PARTICIPATION':
        return {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          titleText: `${displayName} participou de uma Intent realizada`,
          actionVerb: 'Realização alcançada',
        };
      case 'INTENT_REACTED': {
        const rType = item.metadata?.reactionType;
        let reactionLabel = 'Reagiu';
        let reactionIcon = <ThumbsUp className="w-4 h-4 text-amber-600" />;
        if (rType === 'LOVE') {
          reactionLabel = 'Amou';
          reactionIcon = <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />;
        } else if (rType === 'CELEBRATE') {
          reactionLabel = 'Celebrou';
          reactionIcon = <Sparkles className="w-4 h-4 text-emerald-600" />;
        }
        return {
          icon: reactionIcon,
          badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
          titleText: `${displayName} reagiu (${reactionLabel}) a uma Intent`,
          actionVerb: `Reação: ${reactionLabel}`,
        };
      }
      case 'INTENT_COMMENTED':
        return {
          icon: <MessageSquare className="w-4 h-4 text-indigo-600" />,
          badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          titleText: `${displayName} comentou em uma Intent`,
          actionVerb: 'Comentário público',
        };
      default:
        return {
          icon: <Sparkles className="w-4 h-4 text-[#000666]" />,
          badgeBg: 'bg-slate-100 text-[#333] border-slate-200',
          titleText: `${displayName} participou de um acontecimento`,
          actionVerb: 'Atividade',
        };
    }
  };

  return (
    <section aria-labelledby="public-activity-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="public-activity-heading" className="text-xl font-black text-[#1b1c1a]">
            Atividade pública
          </h2>
          <p className="text-xs text-[#666]">
            Linha do tempo cronológica de ações e participações públicas de {displayName}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div role="status" aria-label="Carregando atividades" className="py-12 text-center space-y-3">
          <LoaderCircle className="w-6 h-6 animate-spin text-[#000666] mx-auto" />
          <p className="text-sm font-medium text-[#666]">Carregando linha de atividade pública...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div
          role="alert"
          className="rounded-2xl border border-[#ffb4ab] bg-[#fff8f7] p-5 text-center space-y-3 max-w-md mx-auto"
        >
          <div className="w-10 h-10 rounded-full bg-[#ffdad6] text-[#8c1d18] flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#3b0907]">Falha ao carregar atividades</h3>
            <p className="text-xs text-[#772b27] mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadInitialActivity}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#000666] text-white text-xs font-bold hover:bg-[#1b237b] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="rounded-3xl border border-[#e4e2de] bg-white p-8 sm:p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#f7f6fc] text-[#000666] flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-base text-[#1b1c1a]">
            Nenhuma atividade pública registrada ainda
          </h3>
          <p className="text-sm text-[#666] max-w-md mx-auto">
            As criações de Intents, apoios, comentários e reações públicas aparecerão listadas aqui cronologicamente.
          </p>
        </div>
      )}

      {/* Timeline items */}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const details = getEventDetails(item);
            const isRealized = item.intent.status === 'REALIZED';

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e4e2de] bg-white p-4 sm:p-5 shadow-sm hover:border-[#000666]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  {/* Tipo de evento e tempo relativo */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${details.badgeBg}`}
                    >
                      {details.icon}
                      <span>{details.actionVerb}</span>
                    </span>

                    <span
                      title={formatFullDate(item.occurredAt)}
                      className="text-xs font-semibold text-[#777]"
                    >
                      {formatRelativeTime(item.occurredAt)}
                    </span>
                  </div>

                  {/* Descrição textual do acontecimento */}
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1b1c1a]">
                      {details.titleText}
                    </h3>
                    <p className="text-sm font-semibold text-[#000666] mt-0.5 break-words line-clamp-1">
                      &ldquo;{item.intent.title}&rdquo;
                    </p>
                  </div>

                  {/* Trecho de comentário se aplicável */}
                  {item.type === 'INTENT_COMMENTED' && item.metadata?.commentSnippet && (
                    <blockquote className="text-xs text-[#555] bg-[#f7f6fc] border-l-2 border-[#000666]/40 px-3 py-1.5 rounded-r-lg italic break-words line-clamp-2">
                      &ldquo;{item.metadata.commentSnippet}&rdquo;
                    </blockquote>
                  )}

                  {/* Informações complementares de realização */}
                  {item.type === 'INTENT_REALIZED_PARTICIPATION' && item.metadata?.realizedAt && (
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Concluída em {formatFullDate(item.metadata.realizedAt)}
                    </p>
                  )}
                </div>

                {/* Botão de ação para navegar para a Intent */}
                <div className="shrink-0 flex sm:flex-col items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#f0eee9]">
                  {isRealized && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3 h-3" />
                      Realizada
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectIntent(item.intent.id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#f7f6fc] text-[#000666] text-xs font-bold hover:bg-[#e0e0ff] transition-colors min-h-[38px] self-end"
                  >
                    <span>Ver Intent</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            );
          })}

          {/* Botão Carregar Mais */}
          {nextCursor && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#000666] text-white text-xs font-bold hover:bg-[#1b237b] transition-all min-h-[44px] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <LoaderCircle className="w-4 h-4 animate-spin" />
                    <span>Carregando mais atividades...</span>
                  </>
                ) : (
                  <span>Carregar mais atividades</span>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

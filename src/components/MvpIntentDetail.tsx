import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, Globe, Heart, Info, LoaderCircle, Lock, MessageCircle, Sparkles, ThumbsUp, Users, Vote } from 'lucide-react';
import type { UserAccount } from '../types';
import {
  approveGuardianIntent,
  createIntentComment,
  getIntent,
  IntentApiError,
  listIntentComments,
  removeIntentReaction,
  removeIntentSupport,
  setIntentReaction,
  supportIntent,
  type ApiIntent,
  type ApiIntentComment,
  type IntentCategory,
  type ReactionType,
} from '../services/intentApi';

interface MvpIntentDetailProps {
  intentId: string;
  currentUser: UserAccount;
  onBack: () => void;
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

function VisibilityBadge({ visibility }: { visibility: ApiIntent['visibility'] }) {
  if (visibility === 'PRIVATE') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fff3e0] text-[#e65100] text-[11px] font-bold"><Lock className="w-3 h-3" />Privada</span>;
  }
  if (visibility === 'FOLLOWERS') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e8f5e9] text-[#2e7d32] text-[11px] font-bold"><Users className="w-3 h-3" />Seguidores</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e0e0ff] text-[#000666] text-[11px] font-bold"><Globe className="w-3 h-3" />Pública</span>;
}

function ConditionStatus({ intent }: { intent: ApiIntent }) {
  if (intent.conditionType === 'DATE') {
    return (
      <div className="mt-3 bg-[#f8f7f5] rounded-xl p-2.5 border border-[#e8e6e2] flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[#000666] shrink-0"/>
        <div>
          <p className="font-bold text-xs text-[#1a1a1a]">Revelação por data</p>
          <p className="text-[11px] text-[#666] mt-0.5">
            {intent.revealAt ? `Programada para ${new Date(intent.revealAt).toLocaleString('pt-BR')}.` : 'Data de revelação não informada.'}
          </p>
        </div>
      </div>
    );
  }
  if (intent.conditionType === 'GUARDIANS') {
    const approvals = intent.guardianApprovals?.length ?? 0;
    const goal = intent.guardianApprovalGoal ?? 1;
    return (
      <div className="mt-3 bg-[#f8f7f5] rounded-xl p-2.5 border border-[#e8e6e2] flex items-center gap-2">
        <Vote className="w-4 h-4 text-[#000666] shrink-0"/>
        <div>
          <p className="font-bold text-xs text-[#1a1a1a]">Aguardando guardiões</p>
          <p className="text-[11px] text-[#666] mt-0.5">
            {approvals} de {goal} aprovação(ões). A revelação abre quando atingir o quórum.
          </p>
        </div>
      </div>
    );
  }
  const progress = Math.min(100, Math.round((intent.supportCount * 100) / intent.supportGoal));
  return (
    <div className="mt-3 bg-[#f8f7f5] rounded-xl p-2.5 border border-[#e8e6e2]">
      <div className="flex justify-between items-center text-xs font-bold text-[#1a1a1a]">
        <span>{intent.supportCount} de {intent.supportGoal} apoios</span>
        <span className="text-[#006a62]">{progress}%</span>
      </div>
      <div className="h-2 bg-[#E0F2F1] rounded-full overflow-hidden mt-1.5">
        <div className="h-full bg-[#006a62] transition-all duration-300" style={{ width: `${progress}%` }}/>
      </div>
    </div>
  );
}

export function MvpIntentDetail({ intentId, currentUser, onBack }: MvpIntentDetailProps) {
  const [intent, setIntent] = useState<ApiIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [supporting, setSupporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [comments, setComments] = useState<ApiIntentComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [commentNotice, setCommentNotice] = useState('');

  const [reactionPending, setReactionPending] = useState(false);
  const [reactionError, setReactionError] = useState('');
  const [reactionNotice, setReactionNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setIntent(await getIntent(intentId));
    } catch (caught) {
      setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível carregar esta Intent.');
    } finally {
      setLoading(false);
    }
  }

  async function loadComments() {
    setComments([]);
    setCommentsLoading(true);
    setCommentError('');
    try {
      setComments(await listIntentComments(intentId));
    } catch (caught) {
      setCommentError(caught instanceof IntentApiError ? caught.message : 'Não foi possível carregar os comentários.');
    } finally {
      setCommentsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    void loadComments();
  }, [intentId]);

  async function handleComment() {
    const body = commentBody.trim();
    if (!body || commentSubmitting) return;
    setCommentSubmitting(true);
    setCommentError('');
    setCommentNotice('');
    try {
      const comment = await createIntentComment(intentId, body);
      setComments((current) => [...current, comment]);
      setCommentBody('');
      setCommentNotice('Comentário publicado com sucesso!');
    } catch (caught) {
      setCommentError(caught instanceof IntentApiError ? caught.message : 'Não foi possível publicar seu comentário. Tente novamente.');
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function handleSupport() {
    setSupporting(true);
    setError('');
    setNotice('');
    try {
      const result = intent?.viewerHasSupported
        ? await removeIntentSupport(intentId)
        : await supportIntent(intentId);
      setNotice(result.realizedNow ? 'Você realizou esta Intent!' : result.supported ? 'Seu apoio foi registrado.' : 'Seu apoio foi retirado.');
      setIntent(await getIntent(intentId));
    } catch (caught) {
      setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível registrar o apoio.');
    } finally {
      setSupporting(false);
    }
  }

  async function handleGuardianApproval() {
    setSupporting(true);
    setError('');
    setNotice('');
    try {
      const result = await approveGuardianIntent(intentId);
      setNotice(result.realizedNow ? 'Sua aprovação realizou esta Intent!' : 'Sua aprovação foi registrada.');
      setIntent(await getIntent(intentId));
    } catch (caught) {
      setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível registrar a aprovação.');
    } finally {
      setSupporting(false);
    }
  }

  async function handleReaction(type: ReactionType) {
    if (reactionPending || !intent) return;
    setReactionPending(true);
    setReactionError('');
    setReactionNotice('');
    try {
      const isCurrent = intent.viewerReaction === type;
      const result = isCurrent
        ? await removeIntentReaction(intent.id)
        : await setIntentReaction(intent.id, type);

      setIntent((prev) => prev ? {
        ...prev,
        viewerReaction: result.viewerReaction,
        reactionCounts: result.reactionCounts,
      } : prev);

      if (isCurrent) {
        setReactionNotice('Sua reação foi removida.');
      } else {
        const labels: Record<ReactionType, string> = {
          LIKE: '👍 Curtir',
          LOVE: '❤️ Amar',
          CELEBRATE: '🎉 Celebrar',
        };
        setReactionNotice(`Você reagiu com ${labels[type]}.`);
      }
    } catch (caught) {
      setReactionError(caught instanceof IntentApiError ? caught.message : 'Não foi possível atualizar sua reação.');
    } finally {
      setReactionPending(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto w-full px-3 py-3 sm:px-4 sm:py-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#000666] mb-2.5 hover:underline">
        <ArrowLeft className="w-4 h-4"/>Voltar
      </button>

      {loading && (
        <div className="bg-white border border-[#e4e2de] rounded-xl p-6 text-center text-xs text-[#666] flex flex-col items-center justify-center gap-2">
          <LoaderCircle className="w-5 h-5 animate-spin text-[#000666]"/>
          <span>Carregando Intent...</span>
        </div>
      )}

      {!loading && error && !intent && (
        <div className="bg-[#ffdad6] text-[#8c1d18] rounded-xl p-3.5 flex gap-2.5 items-start text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/>
          <div>
            <p className="font-bold text-sm">Não foi possível carregar a Intent</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {intent && (() => {
        const isMine = intent.creator.id === currentUser.id;
        const totalReactions = Object.values(intent.reactionCounts ?? {}).reduce((acc, count) => acc + count, 0);

        return (
          <article className="bg-white border border-[#e4e2de] rounded-xl p-3.5 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-[#e0e0ff] text-[#000666] flex items-center justify-center font-black text-xs shrink-0">
                  {intent.creator.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs sm:text-sm text-[#1a1a1a] truncate">{intent.creator.displayName}</p>
                  <p className="text-[11px] text-[#666] truncate">@{intent.creator.username.replace(/^@+/, '')}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 shrink-0">
                <span className="inline-block px-2 py-0.5 rounded-full bg-[#f0efff] text-[#000666] text-[11px] font-semibold">
                  {categoryLabels[intent.category] || 'Outros'}
                </span>
                <VisibilityBadge visibility={intent.visibility} />
              </div>
            </div>

            <h1 className="text-base sm:text-lg font-black mt-2 text-[#1a1a1a] leading-tight">{intent.title}</h1>
            {intent.story && <p className="text-xs sm:text-sm text-[#454652] mt-1 whitespace-pre-wrap leading-relaxed">{intent.story}</p>}

            <ConditionStatus intent={intent} />

            {notice && (
              <div className="mt-2.5 p-2 bg-[#e8f5e9] text-[#2e7d32] rounded-lg flex items-center gap-1.5 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0"/>
                <span>{notice}</span>
              </div>
            )}
            {error && (
              <div className="mt-2.5 p-2 bg-[#ffdad6] text-[#8c1d18] rounded-lg flex items-center gap-1.5 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0"/>
                <span>{error}</span>
              </div>
            )}

            {intent.status === 'REALIZED' ? (
              <div className="mt-2.5 bg-[#e8f5e9] border border-[#a5d6a7] rounded-xl p-3">
                <p className="text-[11px] font-bold text-[#2e7d32] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5"/>INTENT REALIZADA
                </p>
                <h2 className="font-black mt-1 text-xs sm:text-sm text-[#1b5e20]">A revelação</h2>
                <p className="text-xs sm:text-sm mt-1 whitespace-pre-wrap text-[#2e7d32] leading-relaxed">{intent.revealContent || 'Conteúdo revelado.'}</p>
              </div>
            ) : (
              <div className="mt-2.5 bg-[#f8f7f5] rounded-xl p-2.5 flex gap-2 items-center border border-[#e8e6e2]">
                <Lock className="w-4 h-4 text-[#000666] shrink-0"/>
                <div>
                  <p className="font-bold text-xs text-[#1a1a1a]">Revelação protegida</p>
                  <p className="text-[11px] text-[#666]">Será aberta automaticamente quando a condição for cumprida.</p>
                </div>
              </div>
            )}

            <div className="mt-2.5 pt-2.5 border-t border-[#e8e6e2]">
              {isMine && (
                <p className="text-xs text-[#666] text-center bg-[#f8f7f5] py-1.5 px-2.5 rounded-lg font-medium">
                  Esta Intent é sua. Você acompanha a realização por aqui.
                </p>
              )}
              {!isMine && intent.status === 'PUBLISHED' && intent.conditionType === 'SUPPORT' && (
                <button
                  onClick={() => void handleSupport()}
                  disabled={supporting}
                  aria-pressed={Boolean(intent.viewerHasSupported)}
                  className={`w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60 transition-colors ${
                    intent.viewerHasSupported
                      ? 'bg-[#e8f5e9] border border-[#2e7d32] text-[#28642f]'
                      : 'bg-[#000666] text-white hover:bg-[#000444]'
                  }`}
                >
                  {supporting ? <LoaderCircle className="w-3.5 h-3.5 animate-spin"/> : intent.viewerHasSupported ? <CheckCircle2 className="w-3.5 h-3.5"/> : <Users className="w-3.5 h-3.5"/>}
                  {supporting ? 'Atualizando...' : intent.viewerHasSupported ? 'Apoiado — clicar para retirar' : 'Apoiar esta Intent'}
                </button>
              )}
              {!isMine && intent.status === 'PUBLISHED' && intent.conditionType === 'GUARDIANS' && intent.viewerIsGuardian && (
                <button
                  onClick={() => void handleGuardianApproval()}
                  disabled={supporting || intent.viewerHasApprovedAsGuardian}
                  className="w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60 bg-[#000666] text-white hover:bg-[#000444]"
                >
                  {supporting ? <LoaderCircle className="w-3.5 h-3.5 animate-spin"/> : <Vote className="w-3.5 h-3.5"/>}
                  {intent.viewerHasApprovedAsGuardian ? 'Aprovação registrada' : supporting ? 'Aprovando...' : 'Aprovar revelação'}
                </button>
              )}
              {!isMine && intent.status === 'PUBLISHED' && intent.conditionType === 'DATE' && (
                <p className="text-xs text-[#666] text-center bg-[#f8f7f5] py-1.5 px-2.5 rounded-lg">Esta Intent será aberta automaticamente na data definida.</p>
              )}
              {!isMine && intent.status === 'REALIZED' && (
                <p className="text-xs text-[#2e7d32] font-bold text-center bg-[#e8f5e9] py-1.5 px-2.5 rounded-lg">
                  {intent.viewerHasSupported ? 'Seu apoio está confirmado e registrado nesta realização.' : 'Esta Intent já foi realizada.'}
                </p>
              )}
            </div>

            {/* REAÇÕES SOCIAIS */}
            <div className="mt-3 pt-2.5 border-t border-[#e8e6e2]">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-[#1a1a1a]">Reações</h3>
                  {totalReactions > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#f0efff] text-[#000666] font-bold">
                      {totalReactions}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void handleReaction('LIKE')}
                  disabled={reactionPending}
                  aria-pressed={intent.viewerReaction === 'LIKE'}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all border disabled:opacity-60 ${
                    intent.viewerReaction === 'LIKE'
                      ? 'bg-[#e0e0ff] border-[#000666] text-[#000666]'
                      : 'bg-[#fbf9f5] border-[#e4e2de] text-[#454652] hover:bg-[#f0efff]'
                  }`}
                >
                  <ThumbsUp className={`w-3.5 h-3.5 ${intent.viewerReaction === 'LIKE' ? 'text-[#000666]' : 'text-[#666]'}`} />
                  <span>Curtir</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-black/5 text-[11px] font-bold">
                    {intent.reactionCounts?.LIKE ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleReaction('LOVE')}
                  disabled={reactionPending}
                  aria-pressed={intent.viewerReaction === 'LOVE'}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all border disabled:opacity-60 ${
                    intent.viewerReaction === 'LOVE'
                      ? 'bg-[#ffebee] border-[#c62828] text-[#c62828]'
                      : 'bg-[#fbf9f5] border-[#e4e2de] text-[#454652] hover:bg-[#ffebee]'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${intent.viewerReaction === 'LOVE' ? 'text-[#c62828] fill-[#c62828]' : 'text-[#666]'}`} />
                  <span>Amar</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-black/5 text-[11px] font-bold">
                    {intent.reactionCounts?.LOVE ?? 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleReaction('CELEBRATE')}
                  disabled={reactionPending}
                  aria-pressed={intent.viewerReaction === 'CELEBRATE'}
                  className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all border disabled:opacity-60 ${
                    intent.viewerReaction === 'CELEBRATE'
                      ? 'bg-[#fff8e1] border-[#f57f17] text-[#e65100]'
                      : 'bg-[#fbf9f5] border-[#e4e2de] text-[#454652] hover:bg-[#fff8e1]'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${intent.viewerReaction === 'CELEBRATE' ? 'text-[#f57f17]' : 'text-[#666]'}`} />
                  <span>Celebrar</span>
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-black/5 text-[11px] font-bold">
                    {intent.reactionCounts?.CELEBRATE ?? 0}
                  </span>
                </button>
              </div>

              {reactionNotice && (
                <div role="status" className="mt-1.5 px-2.5 py-1 bg-[#e8f5e9] text-[#2e7d32] rounded-md text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>{reactionNotice}</span>
                </div>
              )}

              {reactionError && (
                <div role="alert" className="mt-1.5 px-2.5 py-1 bg-[#ffdad6] text-[#8c1d18] rounded-md text-[11px] font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{reactionError}</span>
                </div>
              )}
            </div>

            {/* COMENTÁRIOS */}
            <section className="mt-3 pt-2.5 border-t border-[#e8e6e2]" aria-labelledby="comments-title">
              <div className="flex items-center justify-between mb-2">
                <h2 id="comments-title" className="font-bold text-xs text-[#1a1a1a] flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-[#000666]"/>
                  Comentários
                </h2>
                {comments.length > 0 && (
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#f0efff] text-[#000666] font-bold">
                    {comments.length}
                  </span>
                )}
              </div>

              {commentsLoading && (
                <div className="py-3 text-center text-xs text-[#666] flex items-center justify-center gap-2">
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin text-[#000666]"/>
                  <span>Carregando comentários...</span>
                </div>
              )}

              {!commentsLoading && comments.length === 0 && !commentError && (
                <div className="py-2 px-3 text-center bg-[#fbf9f5] border border-dashed border-[#e4e2de] rounded-lg text-xs text-[#666]">
                  Seja o primeiro a comentar nesta Intent
                </div>
              )}

              {commentError && (
                <div role="alert" className="mt-1.5 p-2 bg-[#ffdad6] text-[#8c1d18] rounded-lg text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0"/>
                  <span>{commentError}</span>
                </div>
              )}

              {!commentsLoading && comments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {comments.map((comment) => (
                    <article key={comment.id} className="p-2.5 bg-[#fbf9f5] border border-[#e8e6e2] rounded-lg flex gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#e0e0ff] text-[#000666] overflow-hidden flex items-center justify-center font-black text-xs shrink-0">
                        {comment.author.avatarUrl ? (
                          <img src={comment.author.avatarUrl} alt="" className="w-full h-full object-cover"/>
                        ) : (
                          comment.author.displayName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-xs">
                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                          <p className="font-bold text-[#1a1a1a]">{comment.author.displayName}</p>
                          <p className="text-[11px] text-[#666]">@{comment.author.username.replace(/^@+/, '')}</p>
                          <time className="text-[10px] text-[#888] ml-auto" dateTime={comment.createdAt}>
                            {new Date(comment.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </time>
                        </div>
                        <p className="mt-1 text-[#333] whitespace-pre-wrap break-words leading-snug">{comment.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {commentNotice && (
                <div role="status" className="mt-1.5 p-2 bg-[#e8f5e9] text-[#2e7d32] rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0"/>
                  <span>{commentNotice}</span>
                </div>
              )}

              <form className="mt-2" onSubmit={(event) => { event.preventDefault(); void handleComment(); }}>
                <textarea
                  id="intent-comment"
                  value={commentBody}
                  maxLength={500}
                  onChange={(event) => setCommentBody(event.target.value)}
                  rows={2}
                  disabled={commentSubmitting}
                  placeholder="Escreva seu comentário sobre esta Intent..."
                  className="w-full resize-none rounded-lg border border-[#c6c5d4] bg-[#fbf9f5] px-2.5 py-1.5 text-xs sm:text-sm outline-none focus:border-[#000666] focus:bg-white disabled:opacity-60 transition-colors"
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[#666]">{commentBody.length}/500</span>
                  <button
                    type="submit"
                    disabled={commentSubmitting || commentBody.trim().length === 0}
                    className="px-3 py-1 rounded-lg bg-[#000666] text-white text-xs font-bold hover:bg-[#000444] disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                  >
                    {commentSubmitting && <LoaderCircle className="w-3 h-3 animate-spin"/>}
                    <span>{commentSubmitting ? 'Publicando...' : 'Comentar'}</span>
                  </button>
                </div>
              </form>
            </section>
          </article>
        );
      })()}
    </div>
  );
}

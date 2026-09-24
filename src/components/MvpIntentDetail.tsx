import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Calendar, Check, CheckCircle2, Clock3, Globe, Heart, Info, LoaderCircle, Lock, MessageCircle, Share2, Sparkles, ThumbsUp, Users, Vote } from 'lucide-react';
import { copyToClipboard, getIntentShareUrl } from '../utils/shareLink';
import type { UserAccount } from '../types';
import { SupportersSection } from './SupportersSection';
import {
  approveGuardianIntent,
  createIntentComment,
  getIntent,
  IntentApiError,
  listIntentComments,
  listIntentHistory,
  listIntentSupporters,
  publishIntent,
  removeIntentReaction,
  removeIntentSupport,
  setIntentReaction,
  supportIntent,
  unwatchIntent,
  watchIntent,
  type ApiIntent,
  type ApiIntentComment,
  type ApiIntentHistoryEvent,
  type ApiIntentSupporter,
  type IntentCategory,
  type ReactionType,
} from '../services/intentApi';

interface MvpIntentDetailProps {
  intentId: string;
  currentUser: UserAccount;
  onBack: () => void;
  onSelectProfile?: (userId: string) => void;
  onSelectIntent?: (intentId: string) => void;
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

function historyText(type: ApiIntentHistoryEvent['type']) {
  switch (type) {
    case 'INTENT_CREATED': return 'A Intent foi criada.';
    case 'SUPPORT_RECEIVED': return 'Um apoio foi registrado.';
    case 'SUPPORT_REMOVED': return 'Um apoio foi retirado.';
    case 'GUARDIAN_APPROVED': return 'Uma aprovação de guardião foi registrada.';
    case 'INTENT_REALIZED': return 'A Intent foi realizada.';
  }
}

function VisibilityBadge({ visibility }: { visibility: ApiIntent['visibility'] }) {
  if (visibility === 'PRIVATE') {
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fff3e0] text-[#e65100] text-xs font-bold"><Lock className="w-3 h-3" />Privada</span>;
  }
  if (visibility === 'FOLLOWERS') {
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e8f5e9] text-[#2e7d32] text-xs font-bold"><Users className="w-3 h-3" />Seguidores</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e0e0ff] text-[#000666] text-xs font-bold"><Globe className="w-3 h-3" />Pública</span>;
}

function ConditionStatus({ intent }: { intent: ApiIntent }) {
  if (intent.conditionType === 'DATE') {
    return (
      <div className="mt-6 bg-[#f5f3ef] rounded-2xl p-5 flex gap-3">
        <Calendar className="w-5 h-5 text-[#000666] shrink-0 mt-0.5"/>
        <div>
          <p className="font-bold text-sm">Revelação por data</p>
          <p className="text-xs text-[#666] mt-1">
            {intent.revealAt ? `Revelação programada para ${new Date(intent.revealAt).toLocaleString('pt-BR')}.` : 'Data de revelação não informada.'}
          </p>
        </div>
      </div>
    );
  }
  if (intent.conditionType === 'GUARDIANS') {
    const approvals = intent.guardianApprovalCount ?? intent.guardianApprovals?.length ?? 0;
    const goal = intent.guardianApprovalGoal ?? 1;
    return (
      <div className="mt-6 bg-[#f5f3ef] rounded-2xl p-5 flex gap-3">
        <Vote className="w-5 h-5 text-[#000666] shrink-0 mt-0.5"/>
        <div>
          <p className="font-bold text-sm">Aguardando guardiões</p>
          <p className="text-xs text-[#666] mt-1">
            {intent.status === 'REALIZED' ? 'Intent realizada.' : `${approvals} de ${goal} aprovação(ões). A Intent será realizada quando atingir o quórum.`}
          </p>
        </div>
      </div>
    );
  }
  const progress = Math.min(100, Math.round((intent.supportCount * 100) / intent.supportGoal));
  const remaining = Math.max(0, intent.supportGoal - intent.supportCount);
  return (
    <div className="mt-6 bg-[#f9f8f6] rounded-2xl p-4 border border-[#e4e2de]">
      <div className="flex justify-between items-center text-sm font-bold text-[#1a1a1a]">
        <span>{intent.supportCount} de {intent.supportGoal} apoios</span>
        <span className="text-[#006a62]">{progress}%</span>
      </div>
      <div className="h-3 bg-[#E0F2F1] rounded-full overflow-hidden mt-2">
        <div className="h-full bg-[#006a62] transition-all duration-300" style={{ width: `${progress}%` }}/>
      </div>
      <p className="mt-3 text-xs text-[#006a62]">
        {remaining === 0 ? 'Meta atingida; a realização é confirmada pelo backend.' : `Faltam ${remaining} apoio(s) para realizar esta Intent.`}
      </p>
    </div>
  );
}

export function MvpIntentDetail({
  intentId,
  currentUser,
  onBack,
  onSelectProfile,
  onSelectIntent,
}: MvpIntentDetailProps) {
  const [intent, setIntent] = useState<ApiIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [supporting, setSupporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [supporters, setSupporters] = useState<ApiIntentSupporter[]>([]);
  const [supportersLoading, setSupportersLoading] = useState(true);

  const [comments, setComments] = useState<ApiIntentComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [commentNotice, setCommentNotice] = useState('');

  const [reactionPending, setReactionPending] = useState(false);
  const [reactionError, setReactionError] = useState('');
  const [reactionNotice, setReactionNotice] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [watchPending, setWatchPending] = useState(false);
  const [publishingDraft, setPublishingDraft] = useState(false);
  const [history, setHistory] = useState<ApiIntentHistoryEvent[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const intentRequestRef = useRef(0);
  const historyRequestRef = useRef(0);

  async function handlePublishDraft() {
    if (!intent || intent.status !== 'DRAFT') return;
    setPublishingDraft(true);
    setError('');
    setNotice('');
    try {
      const published = await publishIntent(intent.id);
      setIntent(published);
      setNotice('Intent publicada com sucesso! Ela agora está disponível de acordo com a visibilidade configurada.');
      void loadHistory(true);
    } catch (caught) {
      setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível publicar a Intent.');
    } finally {
      setPublishingDraft(false);
    }
  }

  async function handleCopyIntentLink() {
    const ok = await copyToClipboard(getIntentShareUrl(intentId));
    setCopySuccess(ok);
    setCopyError(ok ? '' : 'Não foi possível copiar o link.');
  }
  useEffect(() => {
    setCopySuccess(false); setCopyError('');
  }, [intentId]);
  useEffect(() => {
    if (!copySuccess) return;
    const timer = window.setTimeout(() => setCopySuccess(false), 3000);
    return () => window.clearTimeout(timer);
  }, [copySuccess]);

  async function load() {
    const requestId = ++intentRequestRef.current;
    const requestedIntentId = intentId;
    setLoading(true);
    setError('');
    try {
      const nextIntent = await getIntent(requestedIntentId);
      if (requestId === intentRequestRef.current && requestedIntentId === intentId) setIntent(nextIntent);
    } catch (caught) {
      if (requestId === intentRequestRef.current && requestedIntentId === intentId) setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível carregar esta Intent.');
    } finally {
      if (requestId === intentRequestRef.current && requestedIntentId === intentId) setLoading(false);
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

  async function refreshAfterMutation() {
    const requestId = ++intentRequestRef.current;
    const requestedIntentId = intentId;
    try {
      const nextIntent = await getIntent(requestedIntentId);
      if (requestId === intentRequestRef.current && requestedIntentId === intentId) setIntent(nextIntent);
      return true;
    } catch {
      if (requestId === intentRequestRef.current && requestedIntentId === intentId) setError('A ação foi registrada, mas a atualização da Intent está pendente. Tente recarregar.');
      return false;
    }
  }

  async function loadHistory() {
    const requestId = ++historyRequestRef.current;
    const requestedIntentId = intentId;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const page = await listIntentHistory(requestedIntentId);
      if (requestId === historyRequestRef.current && requestedIntentId === intentId) {
        setHistory(page.items);
        setHistoryCursor(page.nextCursor);
      }
    } catch (caught) {
      if (requestId === historyRequestRef.current && requestedIntentId === intentId) setHistoryError(caught instanceof IntentApiError ? caught.message : 'Não foi possível carregar a história desta Intent.');
    } finally {
      if (requestId === historyRequestRef.current && requestedIntentId === intentId) setHistoryLoading(false);
    }
  }

  async function loadSupporters() {
    setSupportersLoading(true);
    try {
      const list = await listIntentSupporters(intentId);
      setSupporters(list);
    } catch {
      // Ignora erro gracioso para manter experiência fluida
    } finally {
      setSupportersLoading(false);
    }
  }

  async function loadMoreHistory() {
    if (!historyCursor || historyLoadingMore) return;
    const requestedIntentId = intentId;
    const requestId = historyRequestRef.current;
    setHistoryLoadingMore(true);
    setHistoryError('');
    try {
      const page = await listIntentHistory(requestedIntentId, historyCursor);
      if (requestId === historyRequestRef.current && requestedIntentId === intentId) {
        setHistory((current) => [...current, ...page.items]);
        setHistoryCursor(page.nextCursor);
      }
    } catch (caught) {
      if (requestId === historyRequestRef.current && requestedIntentId === intentId) setHistoryError(caught instanceof IntentApiError ? caught.message : 'Não foi possível carregar mais acontecimentos.');
    } finally {
      if (requestId === historyRequestRef.current && requestedIntentId === intentId) setHistoryLoadingMore(false);
    }
  }

  useEffect(() => {
    void load();
    void loadComments();
    void loadHistory();
    void loadSupporters();
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
      setNotice(result.realizedNow ? 'A realização foi registrada. Atualizando a Intent...' : result.supported ? 'Seu apoio foi registrado.' : 'Seu apoio foi retirado.');
      setIntent((current) => current && current.id === intentId ? { ...current, supportCount: result.supportCount, supportGoal: result.supportGoal, viewerHasSupported: result.supported } : current);
      await refreshAfterMutation();
      await loadHistory();
      await loadSupporters();
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
      setNotice(result.realizedNow ? 'A realização foi registrada. Atualizando a Intent...' : 'Sua aprovação foi registrada.');
      setIntent((current) => current && current.id === intentId ? { ...current, guardianApprovalCount: result.approvals, viewerHasApprovedAsGuardian: true } : current);
      await refreshAfterMutation();
      await loadHistory();
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

  async function handleWatch() {
    if (!intent || watchPending) return;
    setWatchPending(true);
    setNotice('');
    setError('');
    try {
      const result = intent.viewerWatching ? await unwatchIntent(intent.id) : await watchIntent(intent.id);
      setIntent((current) => current ? { ...current, viewerWatching: result.watching } : current);
      setNotice(result.watching ? 'Você está acompanhando esta Intent.' : 'Você deixou de acompanhar esta Intent.');
    } catch (caught) {
      setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível atualizar o acompanhamento.');
    } finally {
      setWatchPending(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-6 sm:py-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-[#000666] mb-5 hover:underline">
        <ArrowLeft className="w-4 h-4"/>Voltar
      </button>

      {loading && (
        <div className="bg-white border border-[#e4e2de] rounded-2xl p-10 text-center text-sm text-[#666] flex flex-col items-center justify-center gap-3">
          <LoaderCircle className="w-6 h-6 animate-spin text-[#000666]"/>
          <span>Carregando Intent...</span>
        </div>
      )}

      {!loading && error && !intent && (
        <div className="bg-[#ffdad6] text-[#8c1d18] rounded-2xl p-5 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5"/>
          <div>
            <p className="font-bold">Não foi possível carregar a Intent</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {intent && (() => {
        const isMine = intent.creator.id === currentUser.id;
        const totalReactions = Object.values(intent.reactionCounts ?? {}).reduce((acc, count) => acc + count, 0);

        return (
          <article className="bg-white border border-[#e4e2de] rounded-2xl p-5 sm:p-7 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectProfile?.(intent.creator.id)}
                disabled={!onSelectProfile}
                className={`flex items-center gap-3 text-left ${onSelectProfile ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
              >
                <div className="w-11 h-11 rounded-full bg-[#e0e0ff] text-[#000666] flex items-center justify-center font-black text-base shrink-0 overflow-hidden">
                  {intent.creator.avatarUrl ? (
                    <img src={intent.creator.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    intent.creator.displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[#1a1a1a] truncate">{intent.creator.displayName}</p>
                  <p className="text-xs text-[#666] truncate">@{intent.creator.username.replace(/^@+/, '')}</p>
                </div>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
              <span className="inline-block px-2.5 py-1 rounded-full bg-[#f0efff] text-[#000666] text-xs font-bold">
                {categoryLabels[intent.category] || 'Outros'}
              </span>
              {intent.status === 'DRAFT' && (
                <span className="inline-block px-2.5 py-1 rounded-full bg-[#fff3e0] text-[#e65100] border border-[#ffe082] text-xs font-bold">
                  Rascunho
                </span>
              )}
              <VisibilityBadge visibility={intent.visibility} />
              <button type="button" onClick={() => void handleCopyIntentLink()} aria-live="polite"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold text-[#000666]">
                {copySuccess ? <Check className="w-4 h-4"/> : <Share2 className="w-4 h-4"/>}
                {copySuccess ? 'Link copiado!' : 'Compartilhar'}
              </button>
              {copyError && <span role="alert" className="text-xs text-red-700">{copyError}</span>}
            </div>

            {intent.status === 'DRAFT' && (
              <div className="mt-5 bg-[#fff9e6] border border-[#ffe082] rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#b78103]">
                      <Lock className="w-4 h-4" />
                      <span>Rascunho Privado</span>
                    </div>
                    <p className="text-xs text-[#6d5100] mt-1">
                      Esta Intent está salva como rascunho e só você pode vê-la. Ao publicar, ela ficará acessível conforme a visibilidade configurada e poderá receber apoios e interações.
                    </p>
                  </div>
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => void handlePublishDraft()}
                      disabled={publishingDraft}
                      className="px-5 py-2.5 rounded-xl bg-[#000666] text-white text-xs font-bold hover:bg-[#000880] transition-colors flex items-center gap-2 self-start sm:self-auto shrink-0 disabled:opacity-50"
                    >
                      {publishingDraft ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {publishingDraft ? 'Publicando...' : 'Publicar Intent'}
                    </button>
                  )}
                </div>
              </div>
            )}

            <h1 className="text-2xl font-black mt-3 text-[#1a1a1a] leading-tight">{intent.title}</h1>
            <p className="text-sm text-[#454652] mt-3 whitespace-pre-wrap leading-relaxed">{intent.story}</p>

            <ConditionStatus intent={intent} />

            {notice && (
              <div className="mt-5 p-4 bg-[#e8f5e9] text-[#2e7d32] rounded-xl flex items-center gap-2 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5 shrink-0"/>
                <span>{notice}</span>
              </div>
            )}
            {error && (
              <div className="mt-5 p-4 bg-[#ffdad6] text-[#8c1d18] rounded-xl flex items-center gap-2 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0"/>
                <span>{error}</span>
              </div>
            )}

            {intent.status === 'REALIZED' ? (
              <div className="mt-6 bg-[#e8f5e9] border border-[#a5d6a7] rounded-2xl p-5">
                <p className="text-xs font-bold text-[#2e7d32] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4"/>INTENT REALIZADA
                </p>
                <h2 className="font-black mt-3 text-lg text-[#1b5e20]">A revelação</h2>
                <p className="text-sm mt-2 whitespace-pre-wrap text-[#2e7d32] leading-relaxed">{intent.revealContent || 'Conteúdo revelado.'}</p>
              </div>
            ) : (
              <div className="mt-6 bg-[#f5f3ef] rounded-2xl p-5 flex gap-3 items-start">
                <Lock className="w-5 h-5 text-[#000666] shrink-0 mt-0.5"/>
                <div>
                  <p className="font-bold text-sm">Revelação protegida</p>
                  <p className="text-xs text-[#666] mt-1">Será aberta automaticamente quando a condição for cumprida.</p>
                </div>
              </div>
            )}

            <section className="mt-6 pt-6 border-t border-[#e4e2de]" aria-labelledby="history-title">
              <h2 id="history-title" className="font-black text-lg text-[#1a1a1a] flex items-center gap-2">
                <Clock3 className="w-5 h-5 text-[#000666]"/>História da Intent
              </h2>
              <p className="mt-1 text-xs text-[#666]">Acontecimentos reais registrados pelo backend.</p>
              {historyLoading && <div className="py-7 text-center text-sm text-[#666]"><LoaderCircle className="w-5 h-5 animate-spin mx-auto mb-2"/>Carregando história...</div>}
              {!historyLoading && historyError && <p role="alert" className="mt-4 rounded-xl bg-[#ffdad6] p-3 text-sm text-[#8c1d18]">{historyError}</p>}
              {!historyLoading && !historyError && history.length === 0 && <p className="mt-4 rounded-xl bg-[#f5f3ef] p-4 text-sm text-[#666]">Nenhum acontecimento registrado ainda.</p>}
              {!historyLoading && history.length > 0 && <ol className="mt-5 space-y-4 border-l-2 border-[#e0e0ff] pl-5">
                {history.map((event) => <li key={event.id} className="relative">
                  <span className="absolute -left-[29px] top-1 w-3 h-3 rounded-full bg-[#000666] border-2 border-white"/>
                  <p className="text-sm font-bold text-[#1a1a1a]">{historyText(event.type)}</p>
                  <time className="text-xs text-[#666]">{new Date(event.occurredAt).toLocaleString('pt-BR')}</time>
                </li>)}
              </ol>}
              {historyCursor && <button type="button" onClick={() => void loadMoreHistory()} disabled={historyLoadingMore} className="mt-5 w-full rounded-xl border border-[#c6c5d4] py-2.5 text-sm font-bold text-[#000666] disabled:opacity-60">
                {historyLoadingMore ? 'Carregando...' : 'Carregar mais'}
              </button>}
            </section>

            {/* SEÇÃO DE APOIADORES E COMUNIDADE */}
            <div className="mt-6 pt-5 border-t border-[#e4e2de]">
              <SupportersSection
                supportCount={intent.supportCount ?? 0}
                supportGoal={intent.supportGoal ?? 0}
                viewerHasSupported={Boolean(intent.viewerHasSupported)}
                supporting={supporting}
                conditionType={intent.conditionType}
                status={intent.status}
                isMine={isMine}
                supporters={supporters}
                onSupport={() => void handleSupport()}
                onSelectProfile={onSelectProfile}
              />
            </div>

            <div className="mt-6 pt-5 border-t border-[#e4e2de]">
              {!isMine && (
                <button type="button" onClick={() => void handleWatch()} disabled={watchPending} aria-pressed={Boolean(intent.viewerWatching)} className={`mb-3 w-full rounded-xl border py-3 text-sm font-bold disabled:opacity-60 ${intent.viewerWatching ? 'border-[#006a62] bg-[#e0f2f1] text-[#006a62]' : 'border-[#c6c5d4] text-[#000666] hover:bg-[#f5f3ef]'}`}>
                  {watchPending ? 'Atualizando...' : intent.viewerWatching ? 'Acompanhando — clicar para deixar' : 'Acompanhar esta Intent'}
                </button>
              )}
              {!isMine && intent.status === 'PUBLISHED' && (
                <p className="mb-3 rounded-xl bg-[#f5f3ef] px-3 py-2 text-xs leading-relaxed text-[#555]">
                  <strong>Reagir</strong> é uma manifestação social e não conta para a meta.{' '}
                  {intent.conditionType === 'SUPPORT'
                    ? <><strong>Apoiar</strong> registra sua contribuição e é a ação que avança esta meta.</>
                    : intent.conditionType === 'GUARDIANS'
                      ? <><strong>Participação</strong> nesta Intent é a aprovação de um guardião autorizado.</>
                      : 'Esta Intent é realizada automaticamente na data definida.'}
                </p>
              )}
              {isMine && <p className="text-sm text-[#666] text-center">Esta Intent é sua. Você acompanha a realização por aqui.</p>}
              {!isMine && intent.status === 'PUBLISHED' && intent.conditionType === 'SUPPORT' && (
                <button
                  onClick={() => void handleSupport()}
                  disabled={supporting}
                  aria-pressed={Boolean(intent.viewerHasSupported)}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-colors ${
                    intent.viewerHasSupported
                      ? 'bg-[#e8f5e9] border border-[#2e7d32] text-[#28642f]'
                      : 'bg-[#000666] text-white hover:bg-[#000444]'
                  }`}
                >
                  {supporting ? <LoaderCircle className="w-4 h-4 animate-spin"/> : intent.viewerHasSupported ? <CheckCircle2 className="w-4 h-4"/> : <Users className="w-4 h-4"/>}
                  {supporting ? 'Atualizando...' : intent.viewerHasSupported ? 'Apoiado — clicar para retirar apoio' : 'Apoiar esta Intent'}
                </button>
              )}
              {intent.status === 'PUBLISHED' && intent.conditionType === 'GUARDIANS' && intent.viewerIsGuardian && (
                <button
                  onClick={() => void handleGuardianApproval()}
                  disabled={supporting || intent.viewerHasApprovedAsGuardian}
                  className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 bg-[#000666] text-white hover:bg-[#000444]"
                >
                  {supporting ? <LoaderCircle className="w-4 h-4 animate-spin"/> : <Vote className="w-4 h-4"/>}
                  {intent.viewerHasApprovedAsGuardian ? 'Aprovação registrada' : supporting ? 'Aprovando...' : 'Aprovar Intent'}
                </button>
              )}
              {!isMine && intent.status === 'PUBLISHED' && intent.conditionType === 'DATE' && (
                <p className="text-sm text-[#666] text-center">Esta Intent será aberta automaticamente na data definida.</p>
              )}
              {!isMine && intent.status === 'REALIZED' && (
                <p className="text-sm text-[#2e7d32] font-bold text-center">
                  {intent.viewerHasSupported ? 'Seu apoio está confirmado e registrado nesta realização.' : 'Esta Intent já foi realizada.'}
                </p>
              )}
            </div>

            {/* REAÇÕES SOCIAIS */}
            <div className="mt-6 pt-5 border-t border-[#e4e2de]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#1a1a1a]">Reações</h3>
                  {totalReactions > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0efff] text-[#000666] font-bold">
                      {totalReactions}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#777] flex items-center gap-1">
                  <Info className="w-3 h-3 text-[#999]"/>
                  Interação social leve (para trocar, escolha outra; para remover, toque novamente)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => void handleReaction('LIKE')}
                  disabled={reactionPending}
                  aria-pressed={intent.viewerReaction === 'LIKE'}
                  className={`min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between sm:justify-center gap-2 transition-all border disabled:opacity-60 ${
                    intent.viewerReaction === 'LIKE'
                      ? 'bg-[#e0e0ff] border-[#000666] text-[#000666] ring-1 ring-[#000666]'
                      : 'bg-[#fbf9f5] border-[#e4e2de] text-[#454652] hover:bg-[#f0efff] hover:border-[#c0c0f0]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <ThumbsUp className={`w-4 h-4 ${intent.viewerReaction === 'LIKE' ? 'text-[#000666]' : 'text-[#666]'}`} />
                    <span>Curtir</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-black/5 text-xs font-bold">
                      {intent.reactionCounts?.LIKE ?? 0}
                    </span>
                    {intent.viewerReaction === 'LIKE' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#000666] text-white font-bold">Sua reação</span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleReaction('LOVE')}
                  disabled={reactionPending}
                  aria-pressed={intent.viewerReaction === 'LOVE'}
                  className={`min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between sm:justify-center gap-2 transition-all border disabled:opacity-60 ${
                    intent.viewerReaction === 'LOVE'
                      ? 'bg-[#ffebee] border-[#c62828] text-[#c62828] ring-1 ring-[#c62828]'
                      : 'bg-[#fbf9f5] border-[#e4e2de] text-[#454652] hover:bg-[#ffebee] hover:border-[#ffcdd2]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Heart className={`w-4 h-4 ${intent.viewerReaction === 'LOVE' ? 'text-[#c62828] fill-[#c62828]' : 'text-[#666]'}`} />
                    <span>Amar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-black/5 text-xs font-bold">
                      {intent.reactionCounts?.LOVE ?? 0}
                    </span>
                    {intent.viewerReaction === 'LOVE' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c62828] text-white font-bold">Sua reação</span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleReaction('CELEBRATE')}
                  disabled={reactionPending}
                  aria-pressed={intent.viewerReaction === 'CELEBRATE'}
                  className={`min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-between sm:justify-center gap-2 transition-all border disabled:opacity-60 ${
                    intent.viewerReaction === 'CELEBRATE'
                      ? 'bg-[#fff8e1] border-[#f57f17] text-[#e65100] ring-1 ring-[#f57f17]'
                      : 'bg-[#fbf9f5] border-[#e4e2de] text-[#454652] hover:bg-[#fff8e1] hover:border-[#ffe082]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className={`w-4 h-4 ${intent.viewerReaction === 'CELEBRATE' ? 'text-[#f57f17]' : 'text-[#666]'}`} />
                    <span>Celebrar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-black/5 text-xs font-bold">
                      {intent.reactionCounts?.CELEBRATE ?? 0}
                    </span>
                    {intent.viewerReaction === 'CELEBRATE' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f57f17] text-white font-bold">Sua reação</span>
                    )}
                  </div>
                </button>
              </div>

              {reactionNotice && (
                <div role="status" className="mt-3 px-3 py-2 bg-[#e8f5e9] text-[#2e7d32] rounded-lg text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{reactionNotice}</span>
                </div>
              )}

              {reactionError && (
                <div role="alert" className="mt-3 px-3 py-2 bg-[#ffdad6] text-[#8c1d18] rounded-lg text-xs font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{reactionError}</span>
                </div>
              )}
            </div>

            {/* COMENTÁRIOS */}
            <section className="mt-6 pt-6 border-t border-[#e4e2de]" aria-labelledby="comments-title">
              <div className="flex items-center justify-between mb-4">
                <h2 id="comments-title" className="font-black text-lg text-[#1a1a1a] flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-[#000666]"/>
                  Comentários
                </h2>
                {comments.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[#f0efff] text-[#000666] font-bold">
                    {comments.length}
                  </span>
                )}
              </div>

              {commentsLoading && (
                <div className="py-8 text-center text-sm text-[#666] flex flex-col items-center justify-center gap-2">
                  <LoaderCircle className="w-5 h-5 animate-spin text-[#000666]"/>
                  <span>Carregando comentários...</span>
                </div>
              )}

              {!commentsLoading && comments.length === 0 && !commentError && (
                <div className="py-8 text-center bg-[#fbf9f5] border border-dashed border-[#e4e2de] rounded-2xl p-6">
                  <MessageCircle className="w-8 h-8 text-[#a09e98] mx-auto mb-2" />
                  <p className="font-bold text-sm text-[#333]">Seja o primeiro a comentar nesta Intent</p>
                  <p className="text-xs text-[#666] mt-1">Participe da conversa e compartilhe suas impressões com a comunidade.</p>
                </div>
              )}

              {commentError && (
                <div role="alert" className="mt-3 p-3.5 bg-[#ffdad6] text-[#8c1d18] rounded-xl text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0"/>
                  <span>{commentError}</span>
                </div>
              )}

              {!commentsLoading && comments.length > 0 && (
                <div className="mt-3 space-y-3">
                  {comments.map((comment) => (
                    <article key={comment.id} className="p-4 bg-[#fbf9f5] border border-[#e4e2de] rounded-xl flex gap-3 shadow-xs">
                      <button
                        type="button"
                        onClick={() => onSelectProfile?.(comment.author.id)}
                        disabled={!onSelectProfile}
                        className={`w-9 h-9 rounded-full bg-[#e0e0ff] text-[#000666] overflow-hidden flex items-center justify-center font-black text-sm shrink-0 ${onSelectProfile ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      >
                        {comment.author.avatarUrl ? (
                          <img src={comment.author.avatarUrl} alt="" className="w-full h-full object-cover"/>
                        ) : (
                          comment.author.displayName.charAt(0).toUpperCase()
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <button
                            type="button"
                            onClick={() => onSelectProfile?.(comment.author.id)}
                            disabled={!onSelectProfile}
                            className={`text-sm font-bold text-[#1a1a1a] text-left ${onSelectProfile ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
                          >
                            {comment.author.displayName}
                          </button>
                          <p className="text-xs text-[#666]">@{comment.author.username.replace(/^@+/, '')}</p>
                        </div>
                        <p className="mt-1.5 text-sm text-[#333] whitespace-pre-wrap break-words leading-relaxed">{comment.body}</p>
                        <time className="mt-2 block text-[11px] text-[#888]" dateTime={comment.createdAt}>
                          {new Date(comment.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </time>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {commentNotice && (
                <div role="status" className="mt-4 p-3 bg-[#e8f5e9] text-[#2e7d32] rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0"/>
                  <span>{commentNotice}</span>
                </div>
              )}

              <form className="mt-5" onSubmit={(event) => { event.preventDefault(); void handleComment(); }}>
                <label htmlFor="intent-comment" className="text-sm font-bold text-[#1a1a1a] block">Novo comentário</label>
                <textarea
                  id="intent-comment"
                  value={commentBody}
                  maxLength={500}
                  onChange={(event) => setCommentBody(event.target.value)}
                  rows={3}
                  disabled={commentSubmitting}
                  placeholder="Escreva seu comentário sobre esta Intent..."
                  className="mt-2 w-full resize-none rounded-xl border border-[#c6c5d4] bg-[#fbf9f5] px-4 py-3 text-sm outline-none focus:border-[#000666] focus:bg-white disabled:opacity-60 transition-colors"
                />
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="text-xs text-[#666]">{commentBody.length}/500</span>
                  <button
                    type="submit"
                    disabled={commentSubmitting || commentBody.trim().length === 0}
                    className="px-5 py-2.5 rounded-xl bg-[#000666] text-white text-sm font-bold hover:bg-[#000444] disabled:opacity-50 flex items-center gap-2 transition-colors"
                  >
                    {commentSubmitting && <LoaderCircle className="w-4 h-4 animate-spin"/>}
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

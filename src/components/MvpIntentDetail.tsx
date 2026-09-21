import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Globe,
  Heart,
  LoaderCircle,
  Lock,
  LockKeyhole,
  MessageCircle,
  Share2,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Vote,
} from 'lucide-react';
import type { UserAccount } from '../types';
import {
  approveGuardianIntent,
  createIntentComment,
  followProfile,
  getIntent,
  getSocialProfile,
  IntentApiError,
  listIntentComments,
  listIntentSupporters,
  listPublicIntents,
  removeIntentReaction,
  removeIntentSupport,
  setIntentReaction,
  supportIntent,
  unfollowProfile,
  type ApiIntent,
  type ApiIntentComment,
  type ApiIntentSupporter,
  type ApiSocialProfile,
  type IntentCategory,
  type ReactionType,
} from '../services/intentApi';
import { copyToClipboard, getIntentShareUrl } from '../utils/shareLink';
import { SupportersSection } from './SupportersSection';

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

function VisibilityBadge({ visibility }: { visibility: ApiIntent['visibility'] }) {
  if (visibility === 'PRIVATE') {
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#fff3e0] text-[#e65100] text-[11px] font-bold"><Lock className="w-3 h-3" />Privada</span>;
  }
  if (visibility === 'FOLLOWERS') {
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e8f5e9] text-[#2e7d32] text-[11px] font-bold"><Users className="w-3 h-3" />Seguidores</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#e0e0ff] text-[#000666] text-[11px] font-bold"><Globe className="w-3 h-3" />Pública</span>;
}

function ConditionStatus({ intent }: { intent: ApiIntent }) {
  if (intent.conditionType === 'DATE') {
    return (
      <div className="mt-3 bg-[#f8f7f5] rounded-xl p-3 border border-[#e8e6e2] flex items-center gap-2.5">
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
      <div className="mt-3 bg-[#f8f7f5] rounded-xl p-3 border border-[#e8e6e2] flex items-center gap-2.5">
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
    <div className="mt-3 bg-[#f8f7f5] rounded-xl p-3 border border-[#e8e6e2]">
      <div className="flex justify-between items-center text-xs font-bold text-[#1a1a1a]">
        <span className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#003b9a]" />
          {intent.supportCount} de {intent.supportGoal} apoios para a revelação
        </span>
        <span className="text-[#006a62] font-black">{progress}%</span>
      </div>
      <div className="h-2.5 bg-[#E0F2F1] rounded-full overflow-hidden mt-2">
        <div className="h-full bg-gradient-to-r from-[#006a62] to-[#00897b] transition-all duration-300" style={{ width: `${progress}%` }}/>
      </div>
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

  // Perfil social do criador e outras intents recomendadas
  const [creatorProfile, setCreatorProfile] = useState<ApiSocialProfile | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [relatedIntents, setRelatedIntents] = useState<ApiIntent[]>([]);
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

  async function handleCopyIntentLink() {
    const url = getIntentShareUrl(intentId);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getIntent(intentId);
      setIntent(data);

      if (data?.creator?.id) {
        void getSocialProfile(data.creator.id)
          .then((profile) => setCreatorProfile(profile))
          .catch(() => {});
      }
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

  async function loadSupporters() {
    setSupportersLoading(true);
    try {
      setSupporters(await listIntentSupporters(intentId));
    } catch {
      setSupporters([]);
    } finally {
      setSupportersLoading(false);
    }
  }

  async function loadRelated() {
    try {
      const res = await listPublicIntents('public');
      const others = (res.items || []).filter((item) => item.id !== intentId).slice(0, 4);
      setRelatedIntents(others);
    } catch {
      // Ignora falha silenciosa
    }
  }

  useEffect(() => {
    void load();
    void loadSupporters();
    void loadComments();
    void loadRelated();
  }, [intentId]);

  async function handleToggleFollow() {
    if (!creatorProfile || followLoading) return;
    setFollowLoading(true);
    try {
      const updated = creatorProfile.isFollowing
        ? await unfollowProfile(creatorProfile.id)
        : await followProfile(creatorProfile.id);
      setCreatorProfile(updated);
    } catch {
      // Falha silenciosa
    } finally {
      setFollowLoading(false);
    }
  }

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
      void loadSupporters();
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
      void loadSupporters();
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

  const isMine = intent ? intent.creator.id === currentUser.id : false;
  const totalReactions = intent ? Object.values(intent.reactionCounts ?? {}).reduce((acc, count) => acc + count, 0) : 0;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-5">
      {/* Botão de Retorno */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-[#003b9a] hover:text-[#002566] transition-colors py-1.5 px-3 rounded-xl hover:bg-blue-50/70"
        >
          <ArrowLeft className="w-4 h-4"/>
          <span>Voltar ao feed</span>
        </button>

        {intent && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#666]">
            <span className="text-gray-400">Acontecimentos</span>
            <span>/</span>
            <span className="font-semibold text-[#1a1a1a] truncate max-w-[260px]">{intent.title}</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-white border border-[#e4e2de] rounded-2xl p-12 text-center text-xs text-[#666] flex flex-col items-center justify-center gap-3 shadow-whisper">
          <LoaderCircle className="w-6 h-6 animate-spin text-[#003b9a]"/>
          <span className="font-medium text-sm text-[#454652]">Carregando os dados e o cofre da Intent...</span>
        </div>
      )}

      {!loading && error && !intent && (
        <div className="bg-[#ffdad6] text-[#8c1d18] rounded-2xl p-5 flex gap-3 items-start text-xs border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5"/>
          <div>
            <p className="font-bold text-sm">Não foi possível carregar a Intent</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {intent && (
        /* Layout Rico em 2 Colunas: Coluna Principal + Coluna Lateral de Contexto */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 xl:gap-8 items-start">
          
          {/* COLUNA PRINCIPAL (8 colunas no desktop) */}
          <main className="space-y-5 lg:col-span-8">
            <article className="bg-white border border-[#e1e2ec]/80 rounded-2xl p-5 sm:p-7 shadow-whisper">
              {/* Cabeçalho do Card */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#eef0f5]">
                <div
                  onClick={() => onSelectProfile?.(intent.creator.id)}
                  className="flex items-center gap-3 min-w-0 cursor-pointer group"
                >
                  <div className="w-11 h-11 rounded-full bg-[#e0e0ff] text-[#000666] flex items-center justify-center font-black text-sm shrink-0 shadow-xs group-hover:ring-2 group-hover:ring-[#003b9a]/40 transition-all">
                    {intent.creator.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm sm:text-base text-[#1a1a1a] truncate group-hover:text-[#003b9a] transition-colors">
                      {intent.creator.displayName}
                    </p>
                    <p className="text-xs text-[#666] truncate">@{intent.creator.username.replace(/^@+/, '')}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopyIntentLink()}
                    title="Copiar link da Intent"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                      copySuccess
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-[#f7f6fc] text-[#454652] border-[#e4e2de] hover:bg-white hover:text-[#000666]'
                    }`}
                  >
                    {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600"/> : <Share2 className="w-3.5 h-3.5"/>}
                    <span>{copySuccess ? 'Link copiado!' : 'Compartilhar'}</span>
                  </button>
                  <span className="inline-block px-3 py-1 rounded-full bg-[#f0efff] text-[#000666] text-xs font-semibold">
                    {categoryLabels[intent.category] || 'Outros'}
                  </span>
                  <VisibilityBadge visibility={intent.visibility} />
                </div>
              </div>

              {/* Título & História */}
              <div className="mt-4">
                <h1 className="text-xl sm:text-2xl font-black text-[#1a1a1a] leading-tight">
                  {intent.title}
                </h1>
                {intent.story ? (
                  <p className="text-sm sm:text-base text-[#454652] mt-3 whitespace-pre-wrap leading-relaxed">
                    {intent.story}
                  </p>
                ) : (
                  <p className="text-sm text-[#888] italic mt-2">Nenhum relato adicional informado pelo autor.</p>
                )}
              </div>

              {/* Status da Condição e Barra de Progresso */}
              <div className="mt-5">
                <ConditionStatus intent={intent} />
              </div>

              {/* Alertas de Notificação ou Erro */}
              {notice && (
                <div className="mt-3 p-3 bg-[#e8f5e9] text-[#2e7d32] rounded-xl flex items-center gap-2 text-xs sm:text-sm font-bold border border-green-200">
                  <CheckCircle2 className="w-4 h-4 shrink-0"/>
                  <span>{notice}</span>
                </div>
              )}
              {error && (
                <div className="mt-3 p-3 bg-[#ffdad6] text-[#8c1d18] rounded-xl flex items-center gap-2 text-xs sm:text-sm border border-red-200">
                  <AlertCircle className="w-4 h-4 shrink-0"/>
                  <span>{error}</span>
                </div>
              )}

              {/* O Cofre (Lacre de Revelação) */}
              <div className="mt-5">
                {intent.status === 'REALIZED' ? (
                  <div className="bg-gradient-to-br from-[#e8f5e9] to-[#f1f8e9] border-2 border-[#a5d6a7] rounded-2xl p-4 sm:p-5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-black text-[#2e7d32] flex items-center gap-1.5 uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4"/>
                        Intent Realizada com Sucesso
                      </p>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Cofre Aberto
                      </span>
                    </div>
                    <h2 className="font-black text-base sm:text-lg text-[#1b5e20]">O Resultado Revelado</h2>
                    <div className="mt-2 p-3.5 bg-white/80 rounded-xl border border-emerald-200/70">
                      <p className="text-sm sm:text-base whitespace-pre-wrap text-[#1b5e20] leading-relaxed font-medium">
                        {intent.revealContent || 'Conteúdo revelado com sucesso.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-[#f8f9fc] to-[#f0f4ff] rounded-2xl p-4 sm:p-5 border border-[#d6e2fb] flex gap-3.5 items-start">
                    <div className="p-2.5 rounded-xl bg-[#003b9a]/10 text-[#003b9a] shrink-0 mt-0.5">
                      <LockKeyhole className="w-5 h-5"/>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#002566] flex items-center gap-2">
                        Revelação Protegida no Cofre
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-[#003b9a] font-black uppercase">
                          Lacrado
                        </span>
                      </h3>
                      <p className="text-xs sm:text-sm text-[#454652] mt-1 leading-relaxed">
                        O resultado ou conteúdo surpresa desta meta permanece criptografado no servidor. Ele será desbloqueado automaticamente para todos quando os requisitos forem atingidos!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Botão de Ação Principal (Apoiar / Aprovar) */}
              <div className="mt-5 pt-4 border-t border-[#eef0f5]">
                {isMine && (
                  <p className="text-xs sm:text-sm text-[#454652] text-center bg-[#f8f9fc] py-2.5 px-4 rounded-xl font-medium border border-[#e1e2ec]">
                    Esta Intent foi criada por você. Compartilhe o link com amigos e apoiadores para alcançar a meta!
                  </p>
                )}
                {!isMine && intent.status === 'PUBLISHED' && intent.conditionType === 'SUPPORT' && (
                  <button
                    onClick={() => void handleSupport()}
                    disabled={supporting}
                    aria-pressed={Boolean(intent.viewerHasSupported)}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all shadow-xs ${
                      intent.viewerHasSupported
                        ? 'bg-[#e8f5e9] border border-[#2e7d32] text-[#28642f] hover:bg-[#dcedc8]'
                        : 'bg-[#003b9a] text-white hover:bg-[#002d75]'
                    }`}
                  >
                    {supporting ? (
                      <LoaderCircle className="w-4 h-4 animate-spin"/>
                    ) : intent.viewerHasSupported ? (
                      <CheckCircle2 className="w-4 h-4 text-[#2e7d32]"/>
                    ) : (
                      <Users className="w-4 h-4"/>
                    )}
                    <span>
                      {supporting ? 'Atualizando...' : intent.viewerHasSupported ? 'Apoiado — clique para retirar apoio' : 'Apoiar esta Intent'}
                    </span>
                  </button>
                )}
                {!isMine && intent.status === 'PUBLISHED' && intent.conditionType === 'GUARDIANS' && intent.viewerIsGuardian && (
                  <button
                    onClick={() => void handleGuardianApproval()}
                    disabled={supporting || intent.viewerHasApprovedAsGuardian}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 bg-[#003b9a] text-white hover:bg-[#002d75] shadow-xs"
                  >
                    {supporting ? <LoaderCircle className="w-4 h-4 animate-spin"/> : <Vote className="w-4 h-4"/>}
                    <span>
                      {intent.viewerHasApprovedAsGuardian ? 'Aprovação registrada como Guardião' : supporting ? 'Aprovando...' : 'Aprovar revelação do cofre'}
                    </span>
                  </button>
                )}
                {!isMine && intent.status === 'PUBLISHED' && intent.conditionType === 'DATE' && (
                  <p className="text-xs sm:text-sm text-[#555] text-center bg-[#f8f7f5] py-2.5 px-4 rounded-xl border border-[#e8e6e2]">
                    Esta Intent será aberta automaticamente pelo sistema na data e horário combinados.
                  </p>
                )}
                {!isMine && intent.status === 'REALIZED' && (
                  <p className="text-xs sm:text-sm text-[#2e7d32] font-bold text-center bg-[#e8f5e9] py-2.5 px-4 rounded-xl border border-[#a5d6a7]">
                    {intent.viewerHasSupported ? 'Seu apoio fez parte desta realização!' : 'Esta Intent já atingiu seu objetivo e foi revelada.'}
                  </p>
                )}
              </div>

              {/* Reações Sociais */}
              <div className="mt-5 pt-4 border-t border-[#eef0f5]">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-[#1a1a1a]">Reações da Comunidade</h3>
                    {totalReactions > 0 && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#f0efff] text-[#000666] font-bold">
                        {totalReactions}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => void handleReaction('LIKE')}
                    disabled={reactionPending}
                    aria-pressed={intent.viewerReaction === 'LIKE'}
                    className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all border disabled:opacity-60 ${
                      intent.viewerReaction === 'LIKE'
                        ? 'bg-[#e0e0ff] border-[#000666] text-[#000666]'
                        : 'bg-[#fbf9f5] border-[#e4e2de] text-[#454652] hover:bg-[#f0efff]'
                    }`}
                  >
                    <ThumbsUp className={`w-4 h-4 ${intent.viewerReaction === 'LIKE' ? 'text-[#000666]' : 'text-[#666]'}`} />
                    <span>Curtir</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-black/5 text-[11px] font-bold">
                      {intent.reactionCounts?.LIKE ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleReaction('LOVE')}
                    disabled={reactionPending}
                    aria-pressed={intent.viewerReaction === 'LOVE'}
                    className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all border disabled:opacity-60 ${
                      intent.viewerReaction === 'LOVE'
                        ? 'bg-[#ffebee] border-[#c62828] text-[#c62828]'
                        : 'bg-[#fbf9f5] border-[#e4e2de] text-[#454652] hover:bg-[#ffebee]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${intent.viewerReaction === 'LOVE' ? 'text-[#c62828] fill-[#c62828]' : 'text-[#666]'}`} />
                    <span>Amar</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-black/5 text-[11px] font-bold">
                      {intent.reactionCounts?.LOVE ?? 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleReaction('CELEBRATE')}
                    disabled={reactionPending}
                    aria-pressed={intent.viewerReaction === 'CELEBRATE'}
                    className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all border disabled:opacity-60 ${
                      intent.viewerReaction === 'CELEBRATE'
                        ? 'bg-[#fff8e1] border-[#f57f17] text-[#e65100]'
                        : 'bg-[#fbf9f5] border-[#e4e2de] text-[#454652] hover:bg-[#fff8e1]'
                    }`}
                  >
                    <Sparkles className={`w-4 h-4 ${intent.viewerReaction === 'CELEBRATE' ? 'text-[#f57f17]' : 'text-[#666]'}`} />
                    <span>Celebrar</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-black/5 text-[11px] font-bold">
                      {intent.reactionCounts?.CELEBRATE ?? 0}
                    </span>
                  </button>
                </div>

                {reactionNotice && (
                  <div role="status" className="mt-2 px-3 py-1.5 bg-[#e8f5e9] text-[#2e7d32] rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{reactionNotice}</span>
                  </div>
                )}

                {reactionError && (
                  <div role="alert" className="mt-2 px-3 py-1.5 bg-[#ffdad6] text-[#8c1d18] rounded-lg text-xs font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{reactionError}</span>
                  </div>
                )}
              </div>

              {/* SEÇÃO DE APOIADORES (MURAL & PLACEHOLDER VISUAL) */}
              <div className="mt-6">
                <SupportersSection
                  supporters={supporters}
                  supportGoal={intent.supportGoal}
                  supportCount={intent.supportCount}
                  conditionType={intent.conditionType}
                  status={intent.status}
                  isMine={isMine}
                  viewerHasSupported={intent.viewerHasSupported}
                  supporting={supporting}
                  onSupport={() => void handleSupport()}
                  onSelectProfile={onSelectProfile}
                  onShare={() => void handleCopyIntentLink()}
                />
              </div>

              {/* SEÇÃO DE COMENTÁRIOS */}
              <section className="mt-6 pt-5 border-t border-[#eef0f5]" aria-labelledby="comments-title">
                <div className="flex items-center justify-between mb-3">
                  <h2 id="comments-title" className="font-bold text-sm sm:text-base text-[#1a1a1a] flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#003b9a]"/>
                    Comentários e Conversa
                  </h2>
                  {comments.length > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#f0efff] text-[#000666] font-bold">
                      {comments.length} {comments.length === 1 ? 'comentário' : 'comentários'}
                    </span>
                  )}
                </div>

                {/* Formulário de Novo Comentário */}
                <form className="mb-4" onSubmit={(event) => { event.preventDefault(); void handleComment(); }}>
                  <textarea
                    id="intent-comment"
                    value={commentBody}
                    maxLength={500}
                    onChange={(event) => setCommentBody(event.target.value)}
                    rows={3}
                    disabled={commentSubmitting}
                    placeholder="Escreva seu comentário, incentivo ou pergunta sobre esta Intent..."
                    className="w-full resize-none rounded-xl border border-[#c6c5d4] bg-[#fbf9f5] px-3.5 py-2.5 text-xs sm:text-sm outline-none focus:border-[#003b9a] focus:bg-white disabled:opacity-60 transition-colors"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#666]">{commentBody.length}/500</span>
                    <button
                      type="submit"
                      disabled={commentSubmitting || commentBody.trim().length === 0}
                      className="px-4 py-2 rounded-xl bg-[#003b9a] text-white text-xs sm:text-sm font-bold hover:bg-[#002d75] disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      {commentSubmitting && <LoaderCircle className="w-3.5 h-3.5 animate-spin"/>}
                      <span>{commentSubmitting ? 'Publicando...' : 'Comentar'}</span>
                    </button>
                  </div>
                </form>

                {commentNotice && (
                  <div role="status" className="mb-3 p-2.5 bg-[#e8f5e9] text-[#2e7d32] rounded-xl text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0"/>
                    <span>{commentNotice}</span>
                  </div>
                )}

                {commentsLoading && (
                  <div className="py-6 text-center text-xs text-[#666] flex items-center justify-center gap-2">
                    <LoaderCircle className="w-4 h-4 animate-spin text-[#003b9a]"/>
                    <span>Carregando comentários...</span>
                  </div>
                )}

                {!commentsLoading && comments.length === 0 && !commentError && (
                  <div className="py-6 px-4 text-center bg-[#fbf9f5] border border-dashed border-[#e4e2de] rounded-xl text-xs sm:text-sm text-[#666]">
                    Nenhum comentário por enquanto. Seja a primeira pessoa a apoiar e deixar uma mensagem!
                  </div>
                )}

                {commentError && (
                  <div role="alert" className="mb-3 p-2.5 bg-[#ffdad6] text-[#8c1d18] rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0"/>
                    <span>{commentError}</span>
                  </div>
                )}

                {!commentsLoading && comments.length > 0 && (
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <article key={comment.id} className="p-3.5 bg-[#fbf9f5] border border-[#e8e6e2] rounded-xl flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#e0e0ff] text-[#000666] overflow-hidden flex items-center justify-center font-black text-xs shrink-0">
                          {comment.author.avatarUrl ? (
                            <img src={comment.author.avatarUrl} alt="" className="w-full h-full object-cover"/>
                          ) : (
                            comment.author.displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-xs sm:text-sm">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <p className="font-bold text-[#1a1a1a]">{comment.author.displayName}</p>
                            <p className="text-[11px] text-[#666]">@{comment.author.username.replace(/^@+/, '')}</p>
                            <time className="text-[10px] text-[#888] ml-auto" dateTime={comment.createdAt}>
                              {new Date(comment.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </time>
                          </div>
                          <p className="mt-1.5 text-[#333] whitespace-pre-wrap break-words leading-relaxed">{comment.body}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </article>
          </main>

          {/* COLUNA LATERAL DE CONTEXTO (4 colunas no desktop) */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:col-span-4">
            
            {/* CARD 1: Sobre o Criador da Intent */}
            <section className="bg-white border border-[#e1e2ec]/80 rounded-2xl overflow-hidden shadow-whisper">
              <div className="h-16 bg-gradient-to-r from-[#003b9a] via-[#1155d0] to-[#80a4ff]"/>
              <div className="px-5 pb-5 pt-0 relative">
                <div className="-mt-8 mb-3 flex items-end justify-between">
                  <div
                    onClick={() => onSelectProfile?.(intent.creator.id)}
                    className="w-16 h-16 rounded-full border-3 border-white bg-[#e0e0ff] text-[#000666] flex items-center justify-center font-black text-xl shadow-md cursor-pointer hover:opacity-90"
                  >
                    {creatorProfile?.avatarUrl ? (
                      <img src={creatorProfile.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      intent.creator.displayName.charAt(0).toUpperCase()
                    )}
                  </div>
                  {!isMine && (
                    <button
                      onClick={() => void handleToggleFollow()}
                      disabled={followLoading}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                        creatorProfile?.isFollowing
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : 'border-[#003b9a] bg-[#003b9a] text-white hover:bg-[#002d75]'
                      }`}
                    >
                      {followLoading ? (
                        <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                      ) : creatorProfile?.isFollowing ? (
                        <UserCheck className="w-3.5 h-3.5" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>{creatorProfile?.isFollowing ? 'Seguindo' : 'Seguir'}</span>
                    </button>
                  )}
                </div>

                <div
                  onClick={() => onSelectProfile?.(intent.creator.id)}
                  className="cursor-pointer group"
                >
                  <h2 className="font-black text-base text-[#1a1a1a] group-hover:text-[#003b9a] transition-colors">
                    {creatorProfile?.displayName || intent.creator.displayName}
                  </h2>
                  <p className="text-xs text-[#666]">@{creatorProfile?.username || intent.creator.username.replace(/^@+/, '')}</p>
                </div>

                {creatorProfile?.bio && (
                  <p className="text-xs text-[#454652] mt-2.5 line-clamp-3 leading-relaxed">
                    {creatorProfile.bio}
                  </p>
                )}

                {/* Métricas do Autor */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#eef0f5] text-center">
                  <div className="bg-[#f8f9fc] rounded-xl p-2">
                    <p className="text-[11px] text-[#666]">Intents</p>
                    <p className="font-black text-sm text-[#003b9a]">
                      {creatorProfile?.stats?.intentsCreated ?? '—'}
                    </p>
                  </div>
                  <div className="bg-[#f8f9fc] rounded-xl p-2">
                    <p className="text-[11px] text-[#666]">Realizadas</p>
                    <p className="font-black text-sm text-[#2e7d32]">
                      {creatorProfile?.stats?.intentsRealized ?? '—'}
                    </p>
                  </div>
                  <div className="bg-[#f8f9fc] rounded-xl p-2">
                    <p className="text-[11px] text-[#666]">Seguidores</p>
                    <p className="font-black text-sm text-[#1a1a1a]">
                      {creatorProfile?.stats?.followersCount ?? '—'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => onSelectProfile?.(intent.creator.id)}
                  className="w-full mt-3.5 py-2 rounded-xl border border-[#d6e2fb] text-xs font-bold text-[#003b9a] hover:bg-blue-50/50 transition-colors flex items-center justify-center gap-1"
                >
                  <UserRound className="w-3.5 h-3.5" />
                  <span>Ver perfil completo</span>
                </button>
              </div>
            </section>

            {/* CARD: Comunidade e Apoiadores no Sidebar */}
            <section className="bg-white border border-[#e1e2ec]/80 rounded-2xl p-5 shadow-whisper">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#003b9a]" />
                  <h2 className="font-bold text-xs uppercase tracking-wider text-[#1a1a1a]">Mural de Apoio</h2>
                </div>
                <span className="text-[11px] font-black text-[#003b9a] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  {intent.supportCount} {intent.supportCount === 1 ? 'apoio' : 'apoios'}
                </span>
              </div>

              {supporters.length > 0 ? (
                <div>
                  <div className="flex items-center -space-x-2 py-1 overflow-visible">
                    {supporters.slice(0, 5).map((sup) => (
                      <button
                        key={sup.id}
                        type="button"
                        onClick={() => onSelectProfile?.(sup.user.id)}
                        title={`${sup.user.displayName} (@${sup.user.username})`}
                        className="w-9 h-9 rounded-full border-2 border-white bg-[#e0e0ff] text-[#000666] flex items-center justify-center font-bold text-xs shadow-xs hover:scale-115 hover:z-20 transition-all cursor-pointer"
                      >
                        {sup.user.avatarUrl ? (
                          <img
                            src={sup.user.avatarUrl}
                            alt={sup.user.displayName}
                            className="w-full h-full rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          sup.user.displayName.charAt(0).toUpperCase()
                        )}
                      </button>
                    ))}
                    {supporters.length > 5 && (
                      <div className="w-9 h-9 rounded-full border-2 border-white bg-[#1a1a2e] text-white flex items-center justify-center font-black text-[10px] shadow-xs">
                        +{supporters.length - 5}
                      </div>
                    )}

                    {/* Avatar Extra: Convidar Amigos */}
                    <button
                      type="button"
                      onClick={() => void handleCopyIntentLink()}
                      title="Convidar amigos (+ Avatar)"
                      className="w-9 h-9 rounded-full border-2 border-dashed border-[#003b9a] bg-white text-[#003b9a] flex items-center justify-center font-bold text-xs shadow-xs hover:scale-115 hover:bg-blue-50 transition-all ml-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-[#003b9a]" />
                    </button>
                  </div>

                  <p className="text-[11px] text-[#666] mt-2">
                    {supporters.length === 1
                      ? `${supporters[0].user.displayName} é o pioneiro!`
                      : `${supporters[0].user.displayName} e outros ${supporters.length - 1} apoiando.`}
                  </p>

                  {!isMine && intent.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => void handleSupport()}
                      disabled={supporting}
                      className={`mt-3 w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                        intent.viewerHasSupported
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                          : 'bg-[#003b9a] text-white hover:bg-[#002d75]'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${intent.viewerHasSupported ? 'fill-emerald-600 text-emerald-600' : 'text-white'}`} />
                      <span>{intent.viewerHasSupported ? 'Apoiando (Retirar)' : 'Apoiar esta Intent'}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-[#f8f9fd] border border-dashed border-[#c6d7ff] p-3 text-center">
                  <div className="flex items-center justify-center -space-x-2 mb-2">
                    <div className="w-7 h-7 rounded-full border-2 border-white bg-[#e0e0ff] text-[#003b9a] flex items-center justify-center text-[10px] font-bold shadow-xs">
                      1º
                    </div>
                    <div className="w-7 h-7 rounded-full border-2 border-white bg-[#e8f5e9] text-[#2e7d32] flex items-center justify-center text-[10px] font-bold shadow-xs">
                      2º
                    </div>
                    <div className="w-7 h-7 rounded-full border-2 border-white bg-[#fff3e0] text-[#e65100] flex items-center justify-center text-[10px] font-bold shadow-xs">
                      3º
                    </div>
                    {/* Avatar extra no placeholder */}
                    <button
                      type="button"
                      onClick={() => void handleCopyIntentLink()}
                      title="Convidar amigos"
                      className="w-7 h-7 rounded-full border-2 border-dashed border-[#003b9a] bg-white text-[#003b9a] flex items-center justify-center text-[10px] font-bold shadow-xs hover:scale-110 ml-0.5"
                    >
                      <UserPlus className="w-3 h-3 text-[#003b9a]" />
                    </button>
                  </div>
                  <p className="text-xs font-bold text-[#1a1a1a]">Mural disponível</p>
                  <p className="text-[11px] text-[#666] mt-0.5 leading-snug">
                    Primeiras vagas abertas para apoiadores.
                  </p>
                  {!isMine && intent.status === 'PUBLISHED' && (
                    <button
                      type="button"
                      onClick={() => void handleSupport()}
                      disabled={supporting}
                      className={`mt-2.5 w-full py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        intent.viewerHasSupported
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          : 'bg-[#003b9a] text-white hover:bg-[#002d75]'
                      }`}
                    >
                      <Heart className={`w-3 h-3 ${intent.viewerHasSupported ? 'fill-emerald-600 text-emerald-600' : 'text-white'}`} />
                      <span>{intent.viewerHasSupported ? 'Apoiando (Retirar)' : 'Apoiar agora'}</span>
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* CARD 2: Como Funciona o Cofre do Intent */}
            <section className="bg-white border border-[#e1e2ec]/80 rounded-2xl p-5 shadow-whisper">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-[#003b9a]" />
                <h2 className="font-bold text-xs uppercase tracking-wider text-[#1a1a1a]">Como Funciona o Cofre</h2>
              </div>
              <ul className="space-y-3 text-xs text-[#454652]">
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-[#003b9a] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </div>
                  <p className="leading-snug">
                    <strong>Conteúdo Lacrado:</strong> O autor escreveu uma revelação ou resultado que fica criptografado.
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-[#003b9a] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </div>
                  <p className="leading-snug">
                    <strong>Cumprimento da Meta:</strong> Quando os apoios necessários, guardiões ou data forem confirmados...
                  </p>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#2e7d32] flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    3
                  </div>
                  <p className="leading-snug">
                    <strong>Abertura Automática:</strong> O segredo é destravado pelo sistema para todos os apoiadores conferirem!
                  </p>
                </li>
              </ul>
            </section>

            {/* CARD 3: Outros Acontecimentos / Intents Recomendadas */}
            {relatedIntents.length > 0 && (
              <section className="bg-white border border-[#e1e2ec]/80 rounded-2xl p-5 shadow-whisper">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-[#003b9a]" />
                  <h2 className="font-bold text-xs uppercase tracking-wider text-[#1a1a1a]">Outras Intents no Feed</h2>
                </div>
                <div className="space-y-2.5">
                  {relatedIntents.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => onSelectIntent?.(item.id)}
                      className="p-3 rounded-xl border border-[#f0eff5] hover:border-[#003b9a]/40 bg-[#fbf9fc] hover:bg-white transition-all cursor-pointer group"
                    >
                      <span className="text-[10px] font-bold text-[#003b9a] uppercase">
                        {categoryLabels[item.category] || 'Outros'}
                      </span>
                      <p className="font-bold text-xs text-[#1a1a1a] line-clamp-2 mt-0.5 group-hover:text-[#003b9a] transition-colors leading-tight">
                        {item.title}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-[#666] mt-2 pt-1.5 border-t border-black/5">
                        <span>@{item.creator.username.replace(/^@+/, '')}</span>
                        <span className="font-bold text-emerald-700">{item.supportCount} apoios</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </aside>

        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  UserPlus,
  Users,
  ArrowRight,
  Check,
  Share2,
  Copy,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type { ApiIntentSupporter } from '../services/intentApi';

interface SupportersSectionProps {
  supporters: ApiIntentSupporter[];
  supportGoal: number;
  supportCount: number;
  conditionType: 'SUPPORT' | 'DATE' | 'GUARDIANS';
  status: 'PUBLISHED' | 'REALIZED';
  isMine: boolean;
  viewerHasSupported?: boolean;
  supporting: boolean;
  onSupport: () => void;
  onSelectProfile?: (userId: string) => void;
  onShare?: () => void;
}

export function SupportersSection({
  supporters,
  supportGoal,
  supportCount,
  conditionType,
  status,
  isMine,
  viewerHasSupported,
  supporting,
  onSupport,
  onSelectProfile,
  onShare,
}: SupportersSectionProps) {
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [hoveredSupporter, setHoveredSupporter] = useState<string | null>(null);

  const hasSupporters = supporters.length > 0;
  const isSupportCondition = conditionType === 'SUPPORT';
  const remainingToGoal = Math.max(0, supportGoal - supportCount);
  const progressPercent = supportGoal > 0 ? Math.min(100, Math.round((supportCount / supportGoal) * 100)) : 0;

  // Paleta de cores para slots ilustrativos de placeholder
  const placeholderSlots = [
    { bg: 'bg-[#e0e0ff]', text: 'text-[#000666]', border: 'border-white', label: '1º Apoiador' },
    { bg: 'bg-[#e8f5e9]', text: 'text-[#2e7d32]', border: 'border-white', label: '2º Apoiador' },
    { bg: 'bg-[#fff3e0]', text: 'text-[#e65100]', border: 'border-white', label: '3º Apoiador' },
    { bg: 'bg-[#fce4ec]', text: 'text-[#c2185b]', border: 'border-white', label: '4º Apoiador' },
  ];

  function handleInviteClick() {
    if (onShare) {
      onShare();
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2500);
    }
  }

  return (
    <section
      id="intent-supporters-section"
      className="bg-white border border-[#e1e2ec]/80 rounded-2xl p-5 sm:p-6 shadow-whisper overflow-hidden relative"
      aria-labelledby="supporters-section-title"
    >
      {/* Cabeçalho com Título, Meta e Contagem Total de Apoiadores */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#eef0f5]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-[#003b9a] border border-blue-100 shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 id="supporters-section-title" className="font-bold text-base text-[#1a1a1a]">
                Comunidade e Apoiadores
              </h3>
              {supportCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#003b9a] text-xs font-black border border-blue-100/80">
                  <Sparkles className="w-3 h-3 text-[#003b9a]" />
                  {supportCount} {supportCount === 1 ? 'apoiador' : 'apoiadores'}
                </span>
              )}
            </div>
            <p className="text-xs text-[#666] mt-0.5">
              {isSupportCondition
                ? `${supportCount} de ${supportGoal} apoios necessários para destrancar a revelação`
                : `${supportCount} ${supportCount === 1 ? 'pessoa acompanhando o cofre' : 'pessoas acompanhando o cofre'}`}
            </p>
          </div>
        </div>

        {/* Botão de Ação Primária de Apoio no Cabeçalho (Responsivo) */}
        {!isMine && status === 'PUBLISHED' && (
          <button
            type="button"
            onClick={onSupport}
            disabled={supporting}
            className={`group px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
              viewerHasSupported
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100/70 hover:border-emerald-400'
                : 'bg-[#003b9a] text-white hover:bg-[#002d75] hover:scale-[1.02] active:scale-[0.98]'
            } ${supporting ? 'opacity-60 cursor-not-allowed' : ''}`}
            title={viewerHasSupported ? 'Clique para retirar seu apoio' : 'Clique para apoiar esta Intent'}
          >
            <Heart
              className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                viewerHasSupported ? 'fill-emerald-600 text-emerald-600' : 'text-white'
              }`}
            />
            <span>
              {supporting
                ? 'Atualizando...'
                : viewerHasSupported
                ? 'Apoiando (Clique p/ retirar)'
                : 'Apoiar esta Intent'}
            </span>
          </button>
        )}
      </div>

      {/* Barra de Progresso Rumo à Meta de Apoios (se for condição SUPPORT) */}
      {isSupportCondition && (
        <div className="mt-4 pt-1">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-[#555] flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#003b9a]" />
              Progresso do cofre
            </span>
            <span className="font-bold text-[#1a1a1a]">
              {supportCount} <span className="text-[#888] font-normal">/ {supportGoal}</span> ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#eef0f5] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                progressPercent >= 100
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-gradient-to-r from-blue-600 to-[#003b9a]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL: QUANDO HÁ APOIADORES */}
      {hasSupporters ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-[#f9fafc] via-[#f5f8ff] to-[#f0f4ff] border border-[#e1e8f5]">
            {/* Pilha de Avatares com Avatar Extra para Convidar Amigos */}
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center -space-x-2.5 overflow-visible py-1">
                {supporters.slice(0, 7).map((supporter, idx) => {
                  const initial = supporter.user.displayName.charAt(0).toUpperCase();
                  const isHovered = hoveredSupporter === supporter.id;

                  return (
                    <div key={supporter.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => onSelectProfile?.(supporter.user.id)}
                        onMouseEnter={() => setHoveredSupporter(supporter.id)}
                        onMouseLeave={() => setHoveredSupporter(null)}
                        className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-[#e0e0ff] to-[#d0d0fc] text-[#000666] flex items-center justify-center font-bold text-xs shadow-xs hover:scale-115 hover:z-30 transition-all focus:outline-none focus:ring-2 focus:ring-[#003b9a]"
                        title={`${supporter.user.displayName} (@${supporter.user.username})`}
                      >
                        {supporter.user.avatarUrl ? (
                          <img
                            src={supporter.user.avatarUrl}
                            alt={supporter.user.displayName}
                            className="w-full h-full rounded-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          initial
                        )}
                      </button>

                      {/* Tooltip sutil ao passar o cursor */}
                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-[#1a1a2e] text-white text-[10px] font-medium whitespace-nowrap shadow-lg z-40 pointer-events-none animate-in fade-in zoom-in-95">
                          {supporter.user.displayName}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a1a2e]" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Contador de excedentes se houver mais de 7 */}
                {supporters.length > 7 && (
                  <div
                    className="w-10 h-10 rounded-full border-2 border-white bg-[#1a1a2e] text-white flex items-center justify-center font-black text-xs shadow-xs z-10"
                    title={`Mais ${supporters.length - 7} apoiadores`}
                  >
                    +{supporters.length - 7}
                  </div>
                )}

                {/* AVATAR EXTRA: BOTÃO PARA CONVIDAR AMIGOS / COMPARTILHAR */}
                <button
                  type="button"
                  onClick={handleInviteClick}
                  className="w-10 h-10 rounded-full border-2 border-dashed border-[#003b9a] bg-white text-[#003b9a] hover:bg-blue-50/80 hover:border-solid hover:scale-110 transition-all flex items-center justify-center font-bold text-xs shadow-2xs z-20 group ml-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#003b9a]"
                  title="Convidar mais amigos para apoiar"
                  aria-label="Convidar amigos para apoiar"
                >
                  {copiedInvite ? (
                    <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in" />
                  ) : (
                    <UserPlus className="w-4 h-4 text-[#003b9a] group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </div>

              {/* Informação e resumo de apoiadores */}
              <div className="min-w-0 pl-1">
                <p className="font-bold text-xs text-[#1a1a1a] truncate">
                  {supporters[0].user.displayName}
                  {supporters.length > 1 && ` e mais ${supporters.length - 1} ${supporters.length === 2 ? 'pessoa' : 'pessoas'}`}
                </p>
                <p className="text-[11px] text-[#555] flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {status === 'REALIZED'
                    ? 'Apoio garantido — Cofre realizado!'
                    : remainingToGoal > 0
                    ? `Faltam ${remainingToGoal} apoios para o segredo`
                    : 'Meta de apoios alcançada!'}
                </p>
              </div>
            </div>

            {/* Ação de Convidar Amigos com Botão de Destaque */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInviteClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#c6d7ff] text-[#003b9a] hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer"
              >
                {copiedInvite ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-[#003b9a]" />
                    <span>Convidar Amigos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* CONTEÚDO QUANDO NÃO HÁ APOIADORES: PLACEHOLDER VISUAL RICO COM AVATAR EXTRA DE CONVITE */
        <div className="mt-5 rounded-2xl bg-gradient-to-br from-[#fbfcfe] via-[#f6f8fd] to-[#edf2ff] border border-dashed border-[#b8ceff] p-5 sm:p-6 relative overflow-hidden">
          {/* Luz de fundo decorativa */}
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 relative z-10">
            {/* Círculos de Avatares Ilustrativos em Placeholder + Avatar Extra de Convidar */}
            <div className="flex items-center -space-x-3 shrink-0 py-1">
              {placeholderSlots.map((slot, index) => (
                <div
                  key={index}
                  className={`w-11 h-11 rounded-full border-2 ${slot.border} ${slot.bg} ${slot.text} flex items-center justify-center font-bold text-xs shadow-xs relative transition-transform hover:-translate-y-1`}
                  title={slot.label}
                >
                  <UserPlus className="w-4 h-4 opacity-75" />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white text-[9px] font-black text-[#003b9a] flex items-center justify-center border border-blue-100 shadow-2xs">
                    {index + 1}
                  </span>
                </div>
              ))}

              {/* AVATAR EXTRA: CONVIDAR AMIGOS (ESTILO BOTÃO NOVO MEMBRO) */}
              <button
                type="button"
                onClick={handleInviteClick}
                className="w-11 h-11 rounded-full border-2 border-dashed border-[#003b9a] bg-white text-[#003b9a] hover:bg-blue-50 hover:scale-110 transition-all flex items-center justify-center font-bold text-xs shadow-xs z-10 cursor-pointer"
                title="Convidar amigos para inaugurar o mural"
                aria-label="Convidar amigos para inaugurar"
              >
                {copiedInvite ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <UserPlus className="w-4 h-4 text-[#003b9a]" />
                )}
              </button>
            </div>

            {/* Mensagem e Chamada para Interação */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-[#002566]">
                <Sparkles className="w-4 h-4 text-[#003b9a]" />
                <h4 className="font-bold text-sm sm:text-base">
                  {isMine ? 'Seja o primeiro a mobilizar sua rede!' : 'Seja a primeira pessoa a apoiar!'}
                </h4>
              </div>

              <p className="text-xs sm:text-sm text-[#454652] mt-1.5 leading-relaxed">
                {isMine ? (
                  <>
                    Esta Intent ainda não tem apoiadores. Convide seus amigos para apoiarem e destrancarem as primeiras posições do mural!
                  </>
                ) : (
                  <>
                    Inaugure a lista de apoiadores desta causa! Restam {remainingToGoal > 0 ? remainingToGoal : 1}{' '}
                    {remainingToGoal === 1 ? 'apoio' : 'apoios'} para que este segredo seja revelado a todos.
                  </>
                )}
              </p>

              {/* Botões de Ação Dinâmicos */}
              <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                {!isMine && status === 'PUBLISHED' && (
                  <button
                    type="button"
                    onClick={onSupport}
                    disabled={supporting}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                      viewerHasSupported
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                        : 'bg-[#003b9a] text-white hover:bg-[#002d75] hover:scale-[1.02]'
                    } ${supporting ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        viewerHasSupported ? 'fill-emerald-600 text-emerald-600' : 'text-white'
                      }`}
                    />
                    <span>
                      {supporting
                        ? 'Atualizando...'
                        : viewerHasSupported
                        ? 'Você está apoiando (Clique p/ retirar)'
                        : 'Apoiar agora'}
                    </span>
                  </button>
                )}

                {/* Botão de Convidar Amigos com Feedback Visual */}
                <button
                  type="button"
                  onClick={handleInviteClick}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white border border-[#c6d7ff] text-[#003b9a] hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Link Copiado!</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Convidar Amigos (+ Avatar)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import { useState } from 'react';
import {
  Target,
  ArrowRight,
  Play,
  Lock,
  Unlock,
  Heart,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Users,
  X,
  LogIn,
} from 'lucide-react';

interface LandingHeroViewProps {
  onStart: () => void;
  onLogin: () => void;
  onExplore: () => void;
  onViewDemo?: () => void;
}

export function LandingHeroView({ onStart, onLogin, onExplore, onViewDemo }: LandingHeroViewProps) {
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [demoRevealed, setDemoRevealed] = useState(false);
  const [demoSupportCount, setDemoSupportCount] = useState(48);

  function handleOpenDemo() {
    if (onViewDemo) {
      onViewDemo();
    } else {
      setDemoModalOpen(true);
    }
  }

  function handleAddDemoSupport() {
    if (!demoRevealed) {
      const next = demoSupportCount + 1;
      setDemoSupportCount(next);
      if (next >= 50) {
        setDemoRevealed(true);
      }
    }
  }

  return (
    <div className="w-full bg-[#fbf9f5] text-[#1b1c1a] min-h-screen flex flex-col font-sans antialiased selection:bg-[#e0e0ff] selection:text-[#000767]">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-[#e4e2de] bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#000666] rounded-xl flex items-center justify-center shadow-md shadow-[#000666]/15">
              <Target className="text-white w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-[#000666] tracking-tight leading-none">Intent</span>
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#555] mt-0.5">The Expectation Network</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onExplore}
              className="hidden sm:inline-flex text-xs font-bold text-[#454652] hover:text-[#000666] px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Explorar Feed
            </button>
            <button
              onClick={onLogin}
              className="text-xs font-bold text-[#000666] border border-[#c6c5d4] px-4 py-2 rounded-full hover:bg-[#f5f3ef] hover:border-[#000666] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
            <button
              onClick={onStart}
              className="bg-[#000666] text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-[#1a237e] transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>Criar conta</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col lg:flex-row w-full max-w-[1200px] mx-auto items-center justify-between px-4 sm:px-8 py-10 lg:py-16 gap-10">
        {/* Left Column: Content & CTAs */}
        <section className="w-full lg:w-5/12 flex flex-col justify-center z-10 relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#e0e0ff] text-[#000666] text-xs font-bold px-3 py-1.5 rounded-full w-fit mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rede Orientada a Intenções & Expectativas</span>
          </div>

          {/* Messaging */}
          <div className="mb-8">
            <h1 className="text-4xl sm:text-5xl font-black text-[#1b1c1a] mb-4 leading-[1.12]">
              Faça acontecer.<br />
              <span className="text-[#000666]">Juntos.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#454652] max-w-md leading-relaxed">
              Transforme objetivos em realidade com o apoio, acompanhamento e celebração da sua comunidade. O conteúdo só se revela quando a meta é batida.
            </p>
          </div>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <button
              onClick={onStart}
              className="bg-[#000666] text-white font-bold text-sm px-8 py-3.5 rounded-full hover:bg-[#1a237e] hover:shadow-xl hover:shadow-[#000666]/20 hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Criar conta gratuita</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onExplore}
              className="bg-white text-[#000666] border border-[#c6c5d4] font-bold text-sm px-7 py-3.5 rounded-full hover:bg-[#f5f3ef] hover:border-[#000666] transition-all duration-300 flex items-center justify-center cursor-pointer shadow-xs"
            >
              Explorar Feed
            </button>
          </div>

          {/* Interactive Demo Trigger */}
          <button
            onClick={handleOpenDemo}
            className="flex items-center gap-2 text-[#454652] hover:text-[#000666] transition-colors font-bold text-sm w-fit group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-[#eae8e4] flex items-center justify-center group-hover:bg-[#e0e0ff] transition-colors">
              <Play className="w-4 h-4 text-[#1b1c1a] group-hover:text-[#000666] fill-current" />
            </div>
            <span>Ver demonstração interativa do Cofre</span>
          </button>

          {/* Key Pillars */}
          <div className="grid grid-cols-3 gap-3 mt-10 pt-8 border-t border-[#e4e2de]">
            <div>
              <p className="text-xs font-bold text-[#000666] flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                Cofre AES-256
              </p>
              <p className="text-[11px] text-[#555] mt-1">Conteúdo selado até a condição ser cumprida.</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#000666] flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Apoio Coletivo
              </p>
              <p className="text-[11px] text-[#555] mt-1">A comunidade impulsiona cada conquista.</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#000666] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                Revelação Real
              </p>
              <p className="text-[11px] text-[#555] mt-1">Acesso liberado de forma determinística.</p>
            </div>
          </div>
        </section>

        {/* Right Column: Visual Preview & Abstract Graphic */}
        <section className="w-full lg:w-7/12 relative min-h-[460px] flex items-center justify-center p-2 lg:p-0">
          {/* Abstract Background Shapes */}
          <div className="absolute top-1/4 right-0 w-[420px] h-[420px] bg-[#bdc2ff] rounded-full mix-blend-multiply filter blur-[90px] opacity-60 pointer-events-none"></div>
          <div className="absolute bottom-1/4 left-1/4 w-[320px] h-[320px] bg-[#81f3e5] rounded-full mix-blend-multiply filter blur-[80px] opacity-40 pointer-events-none"></div>

          {/* Bento-style UI Mockup Container */}
          <div className="relative w-full max-w-md">
            {/* Main Feed Card */}
            <div className="bg-white/95 rounded-2xl p-6 shadow-[0_20px_40px_rgba(26,35,126,0.08)] border border-[#e4e2de] relative z-20 backdrop-blur-sm">
              {/* User Header */}
              <div className="flex items-center gap-3.5 mb-4">
                <img
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                  alt="Mariana Silva"
                />
                <div>
                  <p className="font-bold text-sm text-[#1b1c1a]">Mariana Silva</p>
                  <p className="text-xs text-[#454652] flex items-center gap-1">
                    <span>Público</span> • <span>Há 2h</span>
                  </p>
                </div>
                <button
                  onClick={handleOpenDemo}
                  className="ml-auto text-[#000666] font-bold text-xs bg-[#e0e0ff] px-3.5 py-1.5 rounded-full hover:bg-[#bdc2ff] transition-colors cursor-pointer"
                >
                  Acompanhar
                </button>
              </div>

              {/* Intent Title */}
              <h2 className="text-base font-bold text-[#1b1c1a] mb-3">
                Concluir certificação UX e lançar portfólio
              </h2>

              {/* Progress Section */}
              <div className="mb-4">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-xs font-semibold text-[#006a62]">Meta: 50 apoiadores</span>
                  <span className="text-[11px] font-bold text-[#00201d] bg-[#84f5e8] px-2 py-0.5 rounded-md">
                    {Math.round((demoSupportCount / 50) * 100)}% concluído ({demoSupportCount}/50)
                  </span>
                </div>
                <div className="w-full bg-[#E0F2F1] rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-[#006a62] h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(100, Math.round((demoSupportCount / 50) * 100))}%` }}
                  ></div>
                </div>
              </div>

              {/* Blurred Content Preview (The 'Reveal' mechanic) */}
              <div
                onClick={handleAddDemoSupport}
                className="h-32 bg-[#efeeea] rounded-xl overflow-hidden relative group cursor-pointer border border-[#c6c5d4]/40"
                title={demoRevealed ? 'Cofre destravado!' : 'Clique para simular um apoio'}
              >
                {demoRevealed ? (
                  <div className="absolute inset-0 bg-[#e6f4ea] flex flex-col items-center justify-center p-4 text-center z-10 animate-fade-in">
                    <Unlock className="w-6 h-6 text-[#137333] mb-1.5" />
                    <span className="text-xs font-bold text-[#137333]">Cofre Revelado com Sucesso!</span>
                    <p className="text-[11px] text-[#1b1c1a] mt-1 font-mono bg-white px-2.5 py-1 rounded-md border border-[#c6c5d4]">
                      https://mariana-ux.design/portfolio-2026
                    </p>
                  </div>
                ) : (
                  <div className="absolute inset-0 backdrop-blur-md bg-white/40 flex flex-col items-center justify-center z-10 transition-all duration-300 group-hover:bg-white/20">
                    <Lock className="w-6 h-6 text-[#000666] mb-1" />
                    <span className="text-xs font-bold text-[#000666]">Conteúdo protegido</span>
                    <span className="text-[10px] text-[#555] mt-0.5 font-medium">Clique no card para testar o apoio</span>
                  </div>
                )}
                <img
                  className="w-full h-full object-cover opacity-60"
                  src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&auto=format&fit=crop&q=80"
                  alt="Prévia protegida"
                />
              </div>

              {/* Interaction Bar */}
              <div className="flex items-center gap-5 mt-4 pt-3.5 border-t border-[#e4e2de]">
                <button
                  type="button"
                  onClick={handleAddDemoSupport}
                  className="flex items-center gap-1.5 text-[#000666] hover:scale-105 cursor-pointer transition-transform"
                >
                  <Heart className="w-4 h-4 fill-current text-rose-500" />
                  <span className="text-xs font-bold">{demoSupportCount} apoios</span>
                </button>
                <div className="flex items-center gap-1.5 text-[#454652]">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs font-bold">5</span>
                </div>
                {/* Avatars of supporters */}
                <div className="ml-auto flex -space-x-2">
                  <img
                    className="w-7 h-7 rounded-full border-2 border-white object-cover"
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                    alt="Apoiador 1"
                  />
                  <img
                    className="w-7 h-7 rounded-full border-2 border-white object-cover"
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
                    alt="Apoiador 2"
                  />
                  <div className="w-7 h-7 rounded-full border-2 border-white bg-[#e4e2de] flex items-center justify-center text-[9px] font-bold text-[#1b1c1a]">
                    +{demoSupportCount - 2}
                  </div>
                </div>
              </div>
            </div>

            {/* Secondary Card Peeking Behind */}
            <div className="absolute -bottom-6 -right-6 w-64 bg-white rounded-xl p-3.5 shadow-[0_10px_30px_rgba(26,35,126,0.05)] border border-[#e4e2de] z-10 opacity-90 transform rotate-3 hidden sm:block">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="w-7 h-7 rounded-full bg-[#ffdbd0] flex items-center justify-center text-[#3a0a00] font-bold text-xs">
                  R
                </div>
                <p className="text-xs font-bold text-[#1b1c1a]">Rafael concluiu um marco!</p>
              </div>
              <p className="text-[11px] text-[#454652] truncate">"Primeiro rascunho do livro enviado..."</p>
            </div>
          </div>
        </section>
      </main>

      {/* Interactive Demo Explanation Modal */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#e4e2de] relative">
            <button
              onClick={() => setDemoModalOpen(false)}
              className="absolute top-5 right-5 text-[#555] hover:text-[#1b1c1a] p-1 rounded-full hover:bg-[#f5f3ef]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-[#000666] text-xs font-bold mb-3">
              <ShieldCheck className="w-4 h-4" />
              <span>Como Funciona o Ciclo Causal</span>
            </div>

            <h3 className="text-2xl font-black text-[#1b1c1a] mb-4">
              A Mecânica do Intent OS
            </h3>

            <div className="space-y-4 my-6">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#000666] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1b1c1a]">Definição da Intenção e Condição</h4>
                  <p className="text-xs text-[#555] mt-0.5">
                    O criador define sua meta pública ou para seguidores (ex: 50 apoiadores ou aprovação de guardiões) e sela o segredo no cofre com criptografia AES-256.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#000666] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1b1c1a]">Mobilização da Comunidade</h4>
                  <p className="text-xs text-[#555] mt-0.5">
                    Amigos, seguidores e entusiastas apoiam, reagem e compartilham a Intent para fazer acontecer.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#000666] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#1b1c1a]">Destravamento Determinístico</h4>
                  <p className="text-xs text-[#555] mt-0.5">
                    Quando o critério é atendido no banco de dados, o cofre é decifrado e os destinatários recebem o acesso exclusivo ao conteúdo prometido.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e4e2de]">
              <button
                onClick={() => setDemoModalOpen(false)}
                className="text-xs font-bold text-[#555] px-4 py-2.5 rounded-xl hover:bg-[#f5f3ef]"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setDemoModalOpen(false);
                  onStart();
                }}
                className="bg-[#000666] text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-[#1a237e] flex items-center gap-1.5 shadow-sm"
              >
                <span>Experimentar Agora</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

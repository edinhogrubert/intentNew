import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Compass,
  Cpu,
  Edit3,
  Eye,
  Film,
  Globe,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Info,
  Lock,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Vote,
  X,
} from 'lucide-react';
import type { UserAccount } from '../types';
import {
  createSupportIntent,
  IntentApiError,
  type ApiIntent,
  type IntentCategory,
} from '../services/intentApi';

interface CreationWizardProps {
  currentUser: UserAccount;
  onCancel: () => void;
  onComplete: (createdIntent: ApiIntent) => void;
}

export interface CategoryOption {
  value: IntentCategory;
  label: string;
  icon: typeof Trophy;
  description: string;
  example: string;
}

export const MVP_CATEGORIES: CategoryOption[] = [
  {
    value: 'SPORTS',
    label: 'Esportes',
    icon: Trophy,
    description: 'Palpites de jogos, desafios esportivos, metas de treino e competições.',
    example: 'Ex.: "Vou acertar o placar do clássico de domingo" ou "Completar 10km em menos de 50 min"',
  },
  {
    value: 'ENTERTAINMENT',
    label: 'Entretenimento & Cultura',
    icon: Film,
    description: 'Filmes, séries, música, games, eventos e cultura pop.',
    example: 'Ex.: "Minha crítica sincera do filme do ano" ou "Teoria secreta sobre o final da temporada"',
  },
  {
    value: 'TECHNOLOGY',
    label: 'Tecnologia & Criação',
    icon: Cpu,
    description: 'Projetos de software, inteligência artificial, hardware e inovações.',
    example: 'Ex.: "Lançamento do meu app open-source" ou "Minha previsão técnica para o novo modelo de IA"',
  },
  {
    value: 'EDUCATION',
    label: 'Educação & Aprendizado',
    icon: GraduationCap,
    description: 'Cursos, leituras, novos idiomas, certificações e pesquisas acadêmicas.',
    example: 'Ex.: "Vou ler 12 livros técnicos neste trimestre" ou "Aprovação no exame de proficiência"',
  },
  {
    value: 'HEALTH_WELLNESS',
    label: 'Saúde & Bem-estar',
    icon: HeartPulse,
    description: 'Hábitos saudáveis, meditação, nutrição e equilíbrio físico e mental.',
    example: 'Ex.: "30 dias sem açúcar refinado" ou "Rotina matinal diária de meditação"',
  },
  {
    value: 'CAREER_BUSINESS',
    label: 'Carreira & Negócios',
    icon: Briefcase,
    description: 'Startups, metas de trabalho, novas contratações, vendas e networking.',
    example: 'Ex.: "Atingir os primeiros 100 clientes pagantes" ou "Transição de carreira em 6 meses"',
  },
  {
    value: 'COMMUNITY_CAUSES',
    label: 'Comunidade & Causas',
    icon: HandHeart,
    description: 'Ações sociais, voluntariado, campanhas solidárias e impacto coletivo.',
    example: 'Ex.: "Mutirão de arrecadação para a creche comunitária" ou "Plantio de 100 mudas"',
  },
  {
    value: 'PERSONAL_LIFE',
    label: 'Vida Pessoal',
    icon: Compass,
    description: 'Metas íntimas, viagens, superação de desafios próprios e projetos de vida.',
    example: 'Ex.: "Minha viagem de mochila pela América do Sul" ou "Aprender a tocar violão"',
  },
  {
    value: 'OTHER',
    label: 'Outros',
    icon: Sparkles,
    description: 'Qualquer outra intenção criativa, previsão curiosa ou experimento social.',
    example: 'Ex.: "Ideia inusitada que quero colocar à prova com meus amigos"',
  },
];

type VisibilityOption = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

interface VisibilityDetails {
  title: string;
  badge: string;
  shortDesc: string;
  feedImpact: string;
  supportImpact: string;
  icon: typeof Globe;
}

const VISIBILITY_CONFIG: Record<VisibilityOption, VisibilityDetails> = {
  PUBLIC: {
    title: 'Pública',
    badge: 'Feed Para você',
    shortDesc: 'Visível para toda a rede no feed público.',
    feedImpact: 'Aparece no feed principal "Para você" de todos os usuários.',
    supportImpact: 'Qualquer pessoa cadastrada pode ver e apoiar sua Intent.',
    icon: Globe,
  },
  FOLLOWERS: {
    title: 'Somente seguidores',
    badge: 'Feed Seguindo',
    shortDesc: 'Exclusiva para as pessoas que seguem seu perfil.',
    feedImpact: 'Aparece no feed "Seguindo" apenas de quem segue você.',
    supportImpact: 'Apenas seus seguidores podem ver e apoiar. Se alguém deixar de seguir, o acesso é revogado.',
    icon: Users,
  },
  PRIVATE: {
    title: 'Privada (Cofre Pessoal)',
    badge: 'Apenas você',
    shortDesc: 'Visível exclusivamente para você em "Minhas Intents".',
    feedImpact: 'Não aparece em nenhum feed público nem de seguidores.',
    supportImpact: 'Ninguém além de você tem acesso. Funciona como seu compromisso lacrado ou cápsula do tempo.',
    icon: Lock,
  },
};

export function CreationWizard({ currentUser, onCancel, onComplete }: CreationWizardProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [category, setCategory] = useState<IntentCategory>('SPORTS');
  const [supportGoal, setSupportGoal] = useState(5);
  const [revealContent, setRevealContent] = useState('');
  const [visibility, setVisibility] = useState<VisibilityOption>('PUBLIC');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedSuccess, setPublishedSuccess] = useState<ApiIntent | null>(null);

  const selectedCategoryOption = useMemo(
    () => MVP_CATEGORIES.find((item) => item.value === category) || MVP_CATEGORIES[0],
    [category],
  );

  const selectedVisibilityConfig = VISIBILITY_CONFIG[visibility];

  function validateCurrentStep(): string {
    if (step === 1) {
      const trimmedTitle = title.trim();
      const trimmedStory = story.trim();
      if (trimmedTitle.length < 3) {
        return 'Por favor, informe um título com pelo menos 3 caracteres (máx. 160).';
      }
      if (trimmedTitle.length > 160) {
        return 'O título não pode ter mais de 160 caracteres.';
      }
      if (trimmedStory.length < 3) {
        return 'Conte um pouco mais sobre o que você quer fazer acontecer (pelo menos 3 caracteres).';
      }
      if (trimmedStory.length > 5000) {
        return 'A história não pode ter mais de 5.000 caracteres.';
      }
    }

    if (step === 2) {
      if (!Number.isInteger(supportGoal) || supportGoal < 1) {
        return 'A meta de apoios deve ser um número inteiro a partir de 1 (ex.: 1, 3, 5, 10...).';
      }
      if (supportGoal > 1_000_000) {
        return 'A meta de apoios não pode exceder 1.000.000.';
      }
      const trimmedReveal = revealContent.trim();
      if (!trimmedReveal) {
        return 'Descreva o conteúdo que será revelado quando a meta for atingida.';
      }
      if (trimmedReveal.length > 10000) {
        return 'O conteúdo da revelação não pode ter mais de 10.000 caracteres.';
      }
    }

    return '';
  }

  async function handleNext() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');

    if (step < 3) {
      setStep((curr) => curr + 1);
      return;
    }

    // Publicação
    setPublishing(true);
    try {
      const created = await createSupportIntent({
        title: title.trim(),
        story: story.trim(),
        category,
        supportGoal,
        revealContent: revealContent.trim(),
        visibility,
      });
      setPublishedSuccess(created);
      setTimeout(() => {
        onComplete(created);
      }, 1000);
    } catch (caught) {
      if (caught instanceof IntentApiError) {
        if (caught.status === 401 || caught.code === 'AUTH_REQUIRED') {
          setError('Sua sessão expirou ou não foi reconhecida. Entre novamente na conta para publicar.');
        } else if (caught.status === 409) {
          setError(`Conflito ao criar Intent: ${caught.message}`);
        } else {
          setError(caught.message || 'Erro ao publicar a Intent. Tente novamente.');
        }
      } else {
        setError('Não foi possível comunicar com o servidor. Verifique sua conexão e tente novamente.');
      }
      setPublishing(false);
    }
  }

  function handleBack() {
    setError('');
    if (step === 1) {
      onCancel();
    } else {
      setStep((curr) => curr - 1);
    }
  }

  if (publishedSuccess) {
    return (
      <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl border border-[#e4e2de] shadow-lg p-8 my-10 text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 bg-[#e8f5e9] text-[#2e7d32] rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-[#1b1c1a]">Intent criada com sucesso!</h2>
        <p className="text-sm text-[#454652] mt-2 max-w-md mx-auto">
          Sua Intent está registrada no sistema com integridade e o segredo permanece criptografado até a meta ser atingida.
        </p>
        <div className="mt-6 p-4 rounded-2xl bg-[#f7f6fc] border border-[#e4e2de] text-left max-w-md mx-auto">
          <p className="text-xs font-bold text-[#000666] uppercase tracking-wider">{selectedCategoryOption.label}</p>
          <p className="font-bold text-base mt-1 text-[#1b1c1a]">{publishedSuccess.title}</p>
          <p className="text-xs text-[#666] mt-2">Visibilidade: {VISIBILITY_CONFIG[publishedSuccess.visibility].title}</p>
        </div>
        <p className="text-xs text-[#777] mt-6 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#000666]" /> Redirecionando para a sua Intent...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-[#fbf9f5] min-h-[85vh] flex flex-col py-4 px-4 sm:px-6 antialiased font-sans">
      {/* Header do Wizard */}
      <header className="flex items-center justify-between pb-4 mb-5 border-b border-[#e4e2de]">
        <button
          onClick={handleBack}
          disabled={publishing}
          className="p-2 rounded-full hover:bg-[#eae8e4] text-[#454652] disabled:opacity-50 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-[#000666]">Criar Nova Intent</h2>
          <span className="text-xs text-[#666] font-medium">Etapa {step} de 3 — {step === 1 ? 'Proposta & Categoria' : step === 2 ? 'Meta & Segredo' : 'Visibilidade & Resumo'}</span>
        </div>
        <button
          onClick={onCancel}
          disabled={publishing}
          className="p-2 rounded-full hover:bg-[#eae8e4] text-[#454652] disabled:opacity-50 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Barra de Progresso das Etapas */}
      <div className="w-full max-w-md mx-auto mb-6">
        <div className="flex justify-between text-xs font-bold text-[#666] mb-2 px-1">
          <span className={step >= 1 ? 'text-[#000666]' : ''}>1. O quê</span>
          <span className={step >= 2 ? 'text-[#000666]' : ''}>2. Meta</span>
          <span className={step >= 3 ? 'text-[#000666]' : ''}>3. Resumo & Publicar</span>
        </div>
        <div className="h-2 w-full bg-[#e4e2de] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#000666] transition-all duration-300 rounded-full"
            style={{ width: `${(step * 100) / 3}%` }}
          />
        </div>
      </div>

      {/* ETAPA 1: O que você quer fazer acontecer? + Categorias reais */}
      {step === 1 && (
        <section className="space-y-6 animate-in fade-in duration-200">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-black text-[#1b1c1a]">
              O que você quer fazer acontecer?
            </h1>
            <p className="text-sm text-[#454652] mt-2 max-w-lg mx-auto">
              Defina o compromisso, palpite ou desafio que você colocará à prova na rede.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#e4e2de] shadow-sm p-6 space-y-6">
            {/* Título */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="intent-title-input" className="text-xs font-bold text-[#1b1c1a] uppercase tracking-wider">
                  Título da Intent <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs ${title.length > 140 ? 'text-amber-600 font-bold' : 'text-[#888]'}`}>
                  {title.length}/160
                </span>
              </div>
              <input
                id="intent-title-input"
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Acertei o placar de 3x1 no clássico / Lançar o app até o fim do mês"
                className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666] focus:ring-1 focus:ring-[#000666] transition-all"
              />
              <p className="text-xs text-[#777] mt-1.5">
                Seja direto e objetivo. O título é a primeira coisa que o público verá no feed.
              </p>
            </div>

            {/* História */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="intent-story-input" className="text-xs font-bold text-[#1b1c1a] uppercase tracking-wider">
                  Conte a história <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs ${story.length > 4500 ? 'text-amber-600 font-bold' : 'text-[#888]'}`}>
                  {story.length}/5000
                </span>
              </div>
              <textarea
                id="intent-story-input"
                value={story}
                maxLength={5000}
                onChange={(e) => setStory(e.target.value)}
                rows={4}
                placeholder="O que você pretende realizar? Por que isso importa e qual é o contexto do seu desafio?"
                className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666] focus:ring-1 focus:ring-[#000666] transition-all resize-none"
              />
              <p className="text-xs text-[#777] mt-1.5">
                Dê contexto para mobilizar os apoiadores a destravarem o seu segredo.
              </p>
            </div>

            {/* Categorias Oficiais do MVP */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#1b1c1a] uppercase tracking-wider">
                  Categoria do MVP <span className="text-red-500">*</span>
                </span>
                <span className="text-xs text-[#000666] font-bold flex items-center gap-1">
                  <selectedCategoryOption.icon className="w-3.5 h-3.5" />
                  {selectedCategoryOption.label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {MVP_CATEGORIES.map((item) => {
                  const Icon = item.icon;
                  const isSelected = category === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setCategory(item.value)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl text-left border transition-all text-xs font-semibold ${
                        isSelected
                          ? 'bg-[#000666] text-white border-[#000666] shadow-sm ring-2 ring-[#000666]/20'
                          : 'bg-[#fbf9f5] text-[#333] border-[#e4e2de] hover:border-[#c6c5d4] hover:bg-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#000666]'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Informação contextual da categoria selecionada */}
              <div className="mt-3.5 p-3.5 rounded-xl bg-[#f0efff] border border-[#d2d1ff] text-xs text-[#1e1f4b] flex items-start gap-2.5">
                <Info className="w-4 h-4 shrink-0 text-[#000666] mt-0.5" />
                <div>
                  <p className="font-bold">{selectedCategoryOption.label}: {selectedCategoryOption.description}</p>
                  <p className="text-[11px] text-[#4a4b75] mt-0.5 italic">{selectedCategoryOption.example}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ETAPA 2: Quando ela será revelada? (Meta e Segredo Criptografado) */}
      {step === 2 && (
        <section className="space-y-6 animate-in fade-in duration-200">
          <div className="text-center">
            <h2 className="text-2xl font-black text-[#1b1c1a]">
              Como funciona o desbloqueio?
            </h2>
            <p className="text-sm text-[#454652] mt-2 max-w-lg mx-auto">
              Defina a quantidade de apoios necessária para que seu segredo seja revelado de forma autônoma.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-white border-2 border-[#000666] rounded-2xl p-4 relative shadow-sm">
              <span className="absolute top-3 right-3 text-[10px] font-extrabold bg-[#e8f5e9] text-[#2e7d32] px-2 py-0.5 rounded-full">
                Ativo no MVP
              </span>
              <Users className="w-5 h-5 text-[#000666]" />
              <p className="font-bold text-sm mt-3 text-[#1b1c1a]">Meta de Apoios</p>
              <p className="text-xs text-[#666] mt-1">
                A Intent destrava quando atingir o número estipulado de apoiadores.
              </p>
            </div>
            <div className="bg-[#f5f3ef] border border-[#e4e2de] rounded-2xl p-4 opacity-75">
              <Calendar className="w-5 h-5 text-[#777]" />
              <p className="font-bold text-sm mt-3 text-[#777]">Data Futura</p>
              <p className="text-xs text-[#888] mt-1">
                Cofre temporal com abertura programada (em breve).
              </p>
            </div>
            <div className="bg-[#f5f3ef] border border-[#e4e2de] rounded-2xl p-4 opacity-75">
              <Vote className="w-5 h-5 text-[#777]" />
              <p className="font-bold text-sm mt-3 text-[#777]">Guardiões</p>
              <p className="text-xs text-[#888] mt-1">
                Validação descentralizada por pares confiáveis (em breve).
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e4e2de] shadow-sm p-6 space-y-6">
            {/* Meta de Apoios */}
            <div>
              <label htmlFor="intent-support-goal" className="block text-xs font-bold text-[#1b1c1a] uppercase tracking-wider mb-2">
                Quantos apoios são necessários para revelar? <span className="text-red-500">*</span>
              </label>

              {/* Opções rápidas */}
              <div className="flex items-center gap-2 mb-3">
                {[1, 3, 5, 10, 25].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSupportGoal(preset)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      supportGoal === preset
                        ? 'bg-[#000666] text-white border-[#000666]'
                        : 'bg-[#fbf9f5] text-[#454652] border-[#e4e2de] hover:bg-white'
                    }`}
                  >
                    {preset} {preset === 1 ? 'apoio' : 'apoios'}
                  </button>
                ))}
              </div>

              <input
                id="intent-support-goal"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000000}
                step={1}
                value={supportGoal}
                onChange={(e) => setSupportGoal(Number(e.target.value))}
                className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666] focus:ring-1 focus:ring-[#000666]"
              />
              <span className="block text-xs text-[#666] mt-2">
                Ao alcançar {supportGoal} {supportGoal === 1 ? 'apoio' : 'apoios'}, o status muda para <strong>REALIZADA</strong> e o texto secreto é aberto aos autorizados.
              </span>
            </div>

            {/* Conteúdo Secreto / Revelação */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="intent-reveal-content" className="flex items-center gap-2 text-xs font-bold text-[#1b1c1a] uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-[#000666]" />
                  Conteúdo da Revelação (Segredo Lacrado) <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-[#888]">{revealContent.length}/10.000</span>
              </div>
              <textarea
                id="intent-reveal-content"
                value={revealContent}
                maxLength={10000}
                onChange={(e) => setRevealContent(e.target.value)}
                rows={4}
                placeholder="Ex.: Meu palpite exato foi 3 a 1 com gols de Fulano e Beltrano. Este conteúdo fica criptografado até bater a meta de apoios!"
                className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666] focus:ring-1 focus:ring-[#000666] resize-none"
              />
              <div className="flex items-center gap-2 text-xs text-[#2e7d32] bg-[#e8f5e9] p-3 rounded-xl mt-2 border border-[#c8e6c9]">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Criptografia em repouso:</strong> O conteúdo fica lacrado no banco de dados e ninguém (nem no feed nem na API) consegue ler até a meta ser atingida.
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ETAPA 3: Quem pode ver + Resumo Completo antes de Publicar */}
      {step === 3 && (
        <section className="space-y-6 animate-in fade-in duration-200">
          <div className="text-center">
            <h2 className="text-2xl font-black text-[#1b1c1a]">
              Quem pode ver e apoiar?
            </h2>
            <p className="text-sm text-[#454652] mt-2 max-w-lg mx-auto">
              Escolha a visibilidade da sua Intent e confira o resumo completo antes de publicar.
            </p>
          </div>

          {/* Cards Claros de Visibilidade (Pública, Seguidores, Privada) */}
          <div className="grid sm:grid-cols-3 gap-3">
            {(['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as VisibilityOption[]).map((optionKey) => {
              const cfg = VISIBILITY_CONFIG[optionKey];
              const Icon = cfg.icon;
              const isSelected = visibility === optionKey;
              return (
                <button
                  key={optionKey}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setVisibility(optionKey)}
                  className={`text-left rounded-2xl border p-4 transition-all focus:outline-none ${
                    isSelected
                      ? 'border-[#000666] bg-white ring-2 ring-[#000666]/20 shadow-sm'
                      : 'border-[#e4e2de] bg-[#fbf9f5] hover:bg-white hover:border-[#c6c5d4]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${isSelected ? 'text-[#000666]' : 'text-[#666]'}`} />
                      <p className="font-bold text-sm text-[#1b1c1a]">{cfg.title}</p>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#000666]" />}
                  </div>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 ${
                    optionKey === 'PUBLIC'
                      ? 'bg-[#e0e0ff] text-[#000666]'
                      : optionKey === 'FOLLOWERS'
                      ? 'bg-[#e8f5e9] text-[#2e7d32]'
                      : 'bg-[#fff3e0] text-[#e65100]'
                  }`}>
                    {cfg.badge}
                  </span>
                  <p className="text-xs text-[#555] leading-relaxed">{cfg.shortDesc}</p>
                </button>
              );
            })}
          </div>

          {/* Alerta explicativo da Visibilidade Escolhida */}
          <div className="p-3.5 rounded-xl bg-[#f0efff] border border-[#d2d1ff] text-xs text-[#1e1f4b] flex items-start gap-2.5">
            <Info className="w-4 h-4 shrink-0 text-[#000666] mt-0.5" />
            <div>
              <p className="font-bold">Regra de Privacidade ({selectedVisibilityConfig.title}):</p>
              <p className="text-[11px] text-[#4a4b75] mt-0.5">
                {selectedVisibilityConfig.feedImpact} {selectedVisibilityConfig.supportImpact}
              </p>
            </div>
          </div>

          {/* Resumo Estruturado antes de Publicar */}
          <div className="bg-white rounded-2xl border border-[#e4e2de] shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0efec]">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#000666]" />
                <h3 className="font-black text-sm uppercase tracking-wider text-[#000666]">
                  Resumo da Publicação
                </h3>
              </div>
              <span className="text-xs text-[#666]">Verifique os detalhes</span>
            </div>

            {/* Itens do Resumo */}
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-[#fbf9f5] border border-[#e4e2de] rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#666]">Categoria</span>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[10px] text-[#000666] font-bold flex items-center gap-0.5 hover:underline"
                  >
                    <Edit3 className="w-3 h-3" /> Alterar
                  </button>
                </div>
                <p className="font-bold text-sm text-[#1b1c1a] mt-1 flex items-center gap-1.5">
                  <selectedCategoryOption.icon className="w-4 h-4 text-[#000666]" />
                  {selectedCategoryOption.label}
                </p>
              </div>

              <div className="bg-[#fbf9f5] border border-[#e4e2de] rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#666]">Meta de Apoios</span>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-[10px] text-[#000666] font-bold flex items-center gap-0.5 hover:underline"
                  >
                    <Edit3 className="w-3 h-3" /> Alterar
                  </button>
                </div>
                <p className="font-bold text-sm text-[#1b1c1a] mt-1 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#000666]" />
                  {supportGoal} {supportGoal === 1 ? 'apoio' : 'apoios'}
                </p>
              </div>

              <div className="bg-[#fbf9f5] border border-[#e4e2de] rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#666]">Segredo Lacrado</span>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-[10px] text-[#000666] font-bold flex items-center gap-0.5 hover:underline"
                  >
                    <Edit3 className="w-3 h-3" /> Alterar
                  </button>
                </div>
                <p className="font-bold text-sm text-[#2e7d32] mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  {revealContent.trim().length} caracteres lacrados
                </p>
              </div>
            </div>

            {/* Prévia Fiel do Card no Feed */}
            <div className="pt-2">
              <span className="block text-xs font-bold text-[#666] mb-3">Prévia do Card no Feed:</span>
              <article className="bg-[#faf9f7] rounded-2xl border border-[#d8d6d2] p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#e0e0ff] flex items-center justify-center font-black text-[#000666]">
                    {currentUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#1b1c1a]">{currentUser.name}</p>
                    <p className="text-xs text-[#666]">
                      @{currentUser.username.replace(/^@+/, '')} · Agora mesmo ·{' '}
                      <span className="font-semibold text-[#000666]">{selectedVisibilityConfig.title}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e0e0ff] text-[#000666] text-xs font-bold">
                    <selectedCategoryOption.icon className="w-3 h-3" />
                    {selectedCategoryOption.label}
                  </span>
                  {visibility === 'FOLLOWERS' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e8f5e9] text-[#28642f] text-xs font-bold">
                      <Users className="w-3 h-3" />
                      Seguidores
                    </span>
                  )}
                  {visibility === 'PRIVATE' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#fff3e0] text-[#e65100] text-xs font-bold">
                      <Lock className="w-3 h-3" />
                      Privada (Cofre)
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-black mt-3 text-[#1b1c1a]">{title || 'Título da Intent'}</h3>
                <p className="text-sm text-[#454652] mt-2 whitespace-pre-wrap">{story || 'Descrição da Intent'}</p>

                <div className="mt-5 rounded-xl bg-white border border-[#e4e2de] p-4 flex items-center gap-3">
                  <Lock className="w-5 h-5 text-[#000666] shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-[#1b1c1a]">0 de {supportGoal} apoios</p>
                    <p className="text-xs text-[#666]">
                      A revelação permanece protegida e criptografada até atingir a meta.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      )}

      {/* Alerta de Erro com Ação */}
      {error && (
        <div
          role="alert"
          className="mt-6 bg-[#ffdad6] text-[#8c1d18] border border-[#ffb4ab] rounded-xl p-4 text-sm font-semibold flex items-start gap-3 animate-in fade-in"
        >
          <X className="w-5 h-5 shrink-0 mt-0.5 cursor-pointer" onClick={() => setError('')} />
          <div>
            <p className="font-bold">Atenção ao publicar:</p>
            <p className="text-xs mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Footer de Navegação e Envio */}
      <footer className="mt-auto pt-8 flex items-center justify-between border-t border-[#e4e2de]">
        <button
          onClick={handleBack}
          disabled={publishing}
          className="px-5 py-3 rounded-xl text-sm font-bold text-[#454652] hover:bg-[#eae8e4] disabled:opacity-50 transition-colors"
        >
          {step === 1 ? 'Cancelar' : 'Voltar'}
        </button>

        <button
          onClick={handleNext}
          disabled={publishing}
          className="px-6 py-3 rounded-xl bg-[#000666] text-white text-sm font-bold flex items-center gap-2 hover:bg-[#000880] disabled:opacity-60 transition-colors shadow-sm"
        >
          {publishing ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              Publicando com criptografia...
            </>
          ) : step === 3 ? (
            <>
              <Check className="w-4 h-4" />
              Publicar Intent
            </>
          ) : (
            <>
              Continuar
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </footer>
    </div>
  );
}

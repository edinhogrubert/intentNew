import { useMemo, useRef, useState } from 'react';
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
  searchUsers,
  type ApiIntent,
  type ApiUserSearchResult,
  type IntentCategory,
} from '../services/intentApi';
import { PersonalContactListsPanel } from './PersonalContactListsPanel';

interface CreationWizardProps {
  currentUser: UserAccount;
  onCancel: () => void;
  onComplete: (createdIntent: ApiIntent) => void;
}

type IconComponent = typeof Trophy;
type VisibilityOption = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
type ConditionOption = 'SUPPORT' | 'DATE' | 'GUARDIANS';

interface CategoryOption {
  value: IntentCategory;
  label: string;
  icon: IconComponent;
  description: string;
  example: string;
}

const categories: CategoryOption[] = [
  { value: 'SPORTS', label: 'Esportes', icon: Trophy, description: 'Palpites, desafios esportivos, metas de treino e competicoes.', example: 'Ex.: acertar o placar do classico.' },
  { value: 'ENTERTAINMENT', label: 'Entretenimento & Cultura', icon: Film, description: 'Filmes, series, musica, games, eventos e cultura pop.', example: 'Ex.: teoria sobre uma temporada.' },
  { value: 'TECHNOLOGY', label: 'Tecnologia & Criacao', icon: Cpu, description: 'Projetos de software, IA, hardware e lancamentos digitais.', example: 'Ex.: publicar uma versao do app.' },
  { value: 'EDUCATION', label: 'Educacao & Aprendizado', icon: GraduationCap, description: 'Cursos, leituras, certificacoes e metas de estudo.', example: 'Ex.: passar em uma prova.' },
  { value: 'HEALTH_WELLNESS', label: 'Saude & Bem-estar', icon: HeartPulse, description: 'Habitos saudaveis, treino, nutricao e equilibrio pessoal.', example: 'Ex.: 30 dias de caminhada.' },
  { value: 'CAREER_BUSINESS', label: 'Carreira & Negocios', icon: Briefcase, description: 'Metas de trabalho, vendas, carreira e startups.', example: 'Ex.: conseguir os primeiros clientes.' },
  { value: 'COMMUNITY_CAUSES', label: 'Comunidade & Causas', icon: HandHeart, description: 'Campanhas, voluntariado, arrecadacoes e impacto coletivo.', example: 'Ex.: organizar um mutirao local.' },
  { value: 'PERSONAL_LIFE', label: 'Vida Pessoal', icon: Compass, description: 'Planos pessoais, viagens, promessas e desafios de vida.', example: 'Ex.: guardar uma mensagem futura.' },
  { value: 'OTHER', label: 'Outros', icon: Sparkles, description: 'Ideias criativas que nao cabem nas outras categorias.', example: 'Ex.: uma aposta divertida.' },
];

const visibilityConfig: Record<VisibilityOption, { title: string; badge: string; description: string; icon: IconComponent; tone: string }> = {
  PUBLIC: { title: 'Publica', badge: 'Feed Para voce', description: 'Toda a rede pode ver.', icon: Globe, tone: 'bg-[#e0e0ff] text-[#000666]' },
  FOLLOWERS: { title: 'Seguidores', badge: 'Feed Seguindo', description: 'Apenas seus seguidores podem ver.', icon: Users, tone: 'bg-[#e8f5e9] text-[#2e7d32]' },
  PRIVATE: { title: 'Privada', badge: 'Cofre pessoal', description: 'Criador e guardioes autorizados.', icon: Lock, tone: 'bg-[#fff3e0] text-[#e65100]' },
};

const conditionConfig: Record<ConditionOption, { title: string; badge: string; description: string; icon: IconComponent }> = {
  SUPPORT: { title: 'Apoios', badge: 'Meta social', description: 'Revela quando atingir a quantidade de apoios.', icon: Users },
  DATE: { title: 'Data', badge: 'Trava de tempo', description: 'Revela automaticamente depois da data escolhida.', icon: Calendar },
  GUARDIANS: { title: 'Guardioes', badge: 'Aprovacao', description: 'Revela quando os guardioes escolhidos aprovarem.', icon: Vote },
};

function createClientIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `intent-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function localDateTimeValue(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function parseRevealDate(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time) : null;
}

export function CreationWizard({ currentUser, onCancel, onComplete }: CreationWizardProps) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [category, setCategory] = useState<IntentCategory>('SPORTS');
  const [visibility, setVisibility] = useState<VisibilityOption>('PUBLIC');
  const [conditionType, setConditionType] = useState<ConditionOption>('SUPPORT');
  const [supportGoal, setSupportGoal] = useState(1);
  const [revealAt, setRevealAt] = useState(() => localDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [guardianSearch, setGuardianSearch] = useState('');
  const [guardianSearchResults, setGuardianSearchResults] = useState<ApiUserSearchResult[]>([]);
  const [guardianSearchLoading, setGuardianSearchLoading] = useState(false);
  const [selectedGuardians, setSelectedGuardians] = useState<ApiUserSearchResult[]>([]);
  const [includeCreatorAsGuardian, setIncludeCreatorAsGuardian] = useState(false);
  const [guardianApprovalGoal, setGuardianApprovalGoal] = useState(1);
  const [revealContent, setRevealContent] = useState('');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishedSuccess, setPublishedSuccess] = useState<ApiIntent | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const selectedCategory = useMemo(() => categories.find((item) => item.value === category) || categories[0], [category]);
  const selectedVisibility = visibilityConfig[visibility];
  const selectedCondition = conditionConfig[conditionType];
  const SelectedCategoryIcon = selectedCategory.icon;
  const SelectedVisibilityIcon = selectedVisibility.icon;
  const SelectedConditionIcon = selectedCondition.icon;
  const creatorGuardian: ApiUserSearchResult = {
    id: currentUser.id,
    username: currentUser.username,
    displayName: currentUser.name,
    bio: currentUser.bio ?? null,
    avatarUrl: currentUser.avatarUrl ?? null,
  };
  const selectedGuardianUsers = includeCreatorAsGuardian ? [creatorGuardian, ...selectedGuardians] : selectedGuardians;
  const guardianIds = [...new Set(selectedGuardianUsers.map((guardian) => guardian.id))];

  function handleVisibilityChange(next: VisibilityOption) {
    setVisibility(next);
    if (next === 'PRIVATE' && conditionType === 'SUPPORT') setConditionType('DATE');
  }

  function handleConditionChange(next: ConditionOption) {
    setConditionType(next);
    if (next === 'SUPPORT' && visibility === 'PRIVATE') setVisibility('PUBLIC');
    if (next === 'GUARDIANS' && visibility !== 'PRIVATE') setVisibility('PRIVATE');
  }

  async function handleGuardianSearch() {
    const query = guardianSearch.trim();
    if (query.length < 2) {
      setError('Digite pelo menos 2 caracteres para buscar guardioes.');
      return;
    }
    setError('');
    setGuardianSearchLoading(true);
    try {
      const results = await searchUsers(query);
      const selectedIds = new Set(selectedGuardians.map((guardian) => guardian.id));
      setGuardianSearchResults(results.filter((user) => !selectedIds.has(user.id)));
    } catch (caught) {
      setError(caught instanceof IntentApiError ? caught.message : 'Nao foi possivel buscar guardioes.');
    } finally {
      setGuardianSearchLoading(false);
    }
  }

  function addGuardian(user: ApiUserSearchResult) {
    if (user.id === currentUser.id) return;
    setSelectedGuardians((current) => current.some((guardian) => guardian.id === user.id) ? current : [...current, user]);
    setGuardianSearchResults((current) => current.filter((result) => result.id !== user.id));
    setGuardianSearch('');
  }

  function removeGuardian(userId: string) {
    setSelectedGuardians((current) => current.filter((guardian) => guardian.id !== userId));
  }

  function validateCurrentStep() {
    const cleanTitle = title.trim();
    const cleanStory = story.trim();
    const cleanReveal = revealContent.trim();

    if (step === 1) {
      if (cleanTitle.length < 3) return 'Informe um titulo com pelo menos 3 caracteres.';
      if (cleanTitle.length > 160) return 'O titulo nao pode ter mais de 160 caracteres.';
      if (cleanStory.length < 3) return 'Conte um pouco mais sobre o que voce quer fazer acontecer.';
      if (cleanStory.length > 5000) return 'A historia nao pode ter mais de 5.000 caracteres.';
    }

    if (step === 2) {
      if (visibility === 'PRIVATE' && conditionType === 'SUPPORT') return 'Intent privada nao pode depender de apoios.';
      if (conditionType === 'SUPPORT' && (!Number.isInteger(supportGoal) || supportGoal < 1)) return 'A meta deve ser um numero inteiro a partir de 1.';
      if (conditionType === 'SUPPORT' && supportGoal > 1_000_000) return 'A meta nao pode exceder 1.000.000 apoios.';
      const parsedRevealAt = parseRevealDate(revealAt);
      if (conditionType === 'DATE' && !parsedRevealAt) return 'Informe uma data e hora validas.';
      if (conditionType === 'DATE' && parsedRevealAt!.getTime() <= Date.now() + 60_000) return 'Escolha uma data pelo menos 1 minuto no futuro.';
      if (conditionType === 'GUARDIANS') {
        if (guardianIds.length === 0) return 'Informe ao menos um ID de guardiao.';
        if (new Set(guardianIds).size !== guardianIds.length) return 'Nao repita guardioes.';
        if (!Number.isInteger(guardianApprovalGoal) || guardianApprovalGoal < 1) return 'A meta de guardioes deve ser ao menos 1.';
        if (guardianApprovalGoal > guardianIds.length) return 'A meta nao pode ser maior que a quantidade de guardioes.';
      }
      if (!cleanReveal) return 'Conte o que sera revelado quando a condicao for cumprida.';
      if (cleanReveal.length > 10000) return 'A revelacao nao pode ter mais de 10.000 caracteres.';
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
      setStep((value) => value + 1);
      return;
    }

    setPublishing(true);
    idempotencyKeyRef.current ||= createClientIdempotencyKey();
    try {
      const created = await createSupportIntent({
        title: title.trim(),
        story: story.trim(),
        category,
        visibility,
        conditionType,
        ...(conditionType === 'SUPPORT' ? { supportGoal } : {}),
        ...(conditionType === 'DATE' ? { revealAt: parseRevealDate(revealAt)!.toISOString() } : {}),
        ...(conditionType === 'GUARDIANS' ? { guardianIds, guardianApprovalGoal } : {}),
        revealContent: revealContent.trim(),
      }, idempotencyKeyRef.current);
      setPublishedSuccess(created);
      window.setTimeout(() => onComplete(created), 800);
    } catch (caught) {
      if (caught instanceof IntentApiError) {
        setError(caught.status === 401 || caught.code === 'AUTH_REQUIRED'
          ? 'Sua sessao expirou. Entre novamente para publicar.'
          : caught.message || 'Nao foi possivel publicar a Intent.');
      } else {
        setError('Nao foi possivel comunicar com o servidor. Tente novamente.');
      }
      setPublishing(false);
    }
  }

  function handleBack() {
    setError('');
    if (step === 1) onCancel();
    else setStep((value) => value - 1);
  }

  if (publishedSuccess) {
    return (
      <div className="w-full max-w-2xl mx-auto bg-white rounded-3xl border border-[#e4e2de] shadow-lg p-8 my-10 text-center">
        <div className="w-16 h-16 bg-[#e8f5e9] text-[#2e7d32] rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8" /></div>
        <h2 className="text-2xl font-black text-[#1b1c1a]">Intent criada com sucesso</h2>
        <p className="text-sm text-[#454652] mt-2 max-w-md mx-auto">Sua Intent foi registrada e sera exibida conforme a visibilidade escolhida.</p>
        <div className="mt-6 p-4 rounded-2xl bg-[#f7f6fc] border border-[#e4e2de] text-left max-w-md mx-auto">
          <p className="text-xs font-bold text-[#000666] uppercase tracking-wider">{conditionConfig[publishedSuccess.conditionType].title}</p>
          <p className="font-bold text-base mt-1 text-[#1b1c1a]">{publishedSuccess.title}</p>
          <p className="text-xs text-[#666] mt-2">Visibilidade: {visibilityConfig[publishedSuccess.visibility].title}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-[#fbf9f5] min-h-[85vh] flex flex-col py-4 px-4 sm:px-6 antialiased font-sans">
      <header className="flex items-center justify-between pb-4 mb-5 border-b border-[#e4e2de]">
        <button onClick={handleBack} disabled={publishing} className="p-2 rounded-full hover:bg-[#eae8e4] text-[#454652] disabled:opacity-50" aria-label="Voltar"><ArrowLeft className="w-5 h-5" /></button>
        <div className="text-center"><h2 className="text-base font-bold text-[#000666]">Nova Intent</h2><span className="text-xs text-[#666]">Etapa {step} de 3</span></div>
        <button onClick={onCancel} disabled={publishing} className="p-2 rounded-full hover:bg-[#eae8e4] text-[#454652] disabled:opacity-50" aria-label="Fechar"><X className="w-5 h-5" /></button>
      </header>

      <div className="w-full max-w-md mx-auto mb-8">
        <div className="flex justify-between text-xs font-bold text-[#666] mb-2 px-1">
          <span className={step >= 1 ? 'text-[#000666]' : ''}>1. Ideia</span>
          <span className={step >= 2 ? 'text-[#000666]' : ''}>2. Regra</span>
          <span className={step >= 3 ? 'text-[#000666]' : ''}>3. Revisao</span>
        </div>
        <div className="h-2 w-full bg-[#e4e2de] rounded-full overflow-hidden"><div className="h-full bg-[#000666] transition-all" style={{ width: `${(step * 100) / 3}%` }} /></div>
      </div>

      {step === 1 && (
        <section className="space-y-6">
          <div className="text-center"><h1 className="text-2xl sm:text-3xl font-black text-[#1b1c1a]">O que voce quer fazer acontecer?</h1><p className="text-sm text-[#454652] mt-2">Comece simples. A Intent pode ser um palpite, desafio, promessa ou cofre pessoal.</p></div>
          <div className="bg-white rounded-2xl border border-[#e4e2de] shadow-sm p-6 space-y-5">
            <label className="block"><span className="flex justify-between text-xs font-bold mb-2"><span>Titulo</span><span className="text-[#888]">{title.length}/160</span></span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Vou acertar o placar do jogo do meu time" className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666]" /></label>
            <label className="block"><span className="flex justify-between text-xs font-bold mb-2"><span>Conte a historia</span><span className="text-[#888]">{story.length}/5000</span></span><textarea value={story} maxLength={5000} onChange={(event) => setStory(event.target.value)} rows={4} placeholder="O que voce pretende fazer e por que isso importa?" className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666] resize-none" /></label>
            <div>
              <div className="flex items-center justify-between mb-3"><span className="text-xs font-bold">Categoria</span><span className="text-xs text-[#000666] font-bold flex items-center gap-1"><SelectedCategoryIcon className="w-3.5 h-3.5" /> {selectedCategory.label}</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {categories.map((item) => {
                  const Icon = item.icon;
                  const selected = category === item.value;
                  return <button key={item.value} type="button" onClick={() => setCategory(item.value)} className={`flex items-center gap-2 p-3 rounded-xl text-left border text-xs font-bold transition-colors ${selected ? 'bg-[#000666] text-white border-[#000666]' : 'bg-[#f5f3ef] text-[#454652] border-[#e4e2de] hover:bg-white'}`}><Icon className="w-4 h-4 shrink-0" /><span className="truncate">{item.label}</span></button>;
                })}
              </div>
              <div className="mt-3 p-3 rounded-xl bg-[#f0efff] border border-[#d2d1ff] text-xs text-[#1e1f4b] flex gap-2"><Info className="w-4 h-4 shrink-0 text-[#000666]" /><p><strong>{selectedCategory.description}</strong> {selectedCategory.example}</p></div>
            </div>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <div className="text-center"><h2 className="text-2xl font-black text-[#1b1c1a]">Quem ve e quando revela?</h2><p className="text-sm text-[#454652] mt-2">Toda combinacao precisa poder se realizar.</p></div>
          <div className="grid sm:grid-cols-3 gap-3">
            {(Object.keys(visibilityConfig) as VisibilityOption[]).map((key) => {
              const config = visibilityConfig[key];
              const Icon = config.icon;
              const selected = visibility === key;
              return <button key={key} type="button" onClick={() => handleVisibilityChange(key)} className={`text-left rounded-2xl border p-4 transition-colors ${selected ? 'border-[#000666] bg-white ring-2 ring-[#000666]/10' : 'border-[#e4e2de] bg-[#f5f3ef] hover:bg-white'}`}><div className="flex items-center gap-2 font-bold text-sm"><Icon className="w-4 h-4 text-[#000666]" />{config.title}</div><span className={`inline-block mt-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${config.tone}`}>{config.badge}</span><p className="text-xs text-[#666] mt-2">{config.description}</p></button>;
            })}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {(Object.keys(conditionConfig) as ConditionOption[]).map((key) => {
              const config = conditionConfig[key];
              const Icon = config.icon;
              const selected = conditionType === key;
              const disabled = visibility === 'PRIVATE' && key === 'SUPPORT';
              return <button key={key} type="button" disabled={disabled} onClick={() => handleConditionChange(key)} className={`text-left rounded-2xl border p-4 transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${selected ? 'border-[#000666] bg-white ring-2 ring-[#000666]/10' : 'border-[#e4e2de] bg-[#f5f3ef] hover:bg-white'}`}><div className="flex items-center gap-2 font-bold text-sm"><Icon className="w-4 h-4 text-[#000666]" />{config.title}</div><span className="inline-block mt-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e0e0ff] text-[#000666]">{config.badge}</span><p className="text-xs text-[#666] mt-2">{disabled ? 'Privada nao pode depender de apoios.' : config.description}</p></button>;
            })}
          </div>
          <div className="bg-white rounded-2xl border border-[#e4e2de] shadow-sm p-6 space-y-5">
            {conditionType === 'SUPPORT' && <div><span className="block text-xs font-bold mb-2">Quantos apoios sao necessarios?</span><div className="flex flex-wrap gap-2 mb-3">{[1, 3, 5, 10, 25].map((value) => <button key={value} type="button" onClick={() => setSupportGoal(value)} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border ${supportGoal === value ? 'bg-[#000666] text-white border-[#000666]' : 'bg-[#fbf9f5] text-[#454652] border-[#e4e2de]'}`}>{value}</button>)}</div><input type="number" inputMode="numeric" min={1} step={1} value={supportGoal} onChange={(event) => setSupportGoal(Number(event.target.value))} className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666]" /></div>}
            {conditionType === 'DATE' && <label className="block"><span className="block text-xs font-bold mb-2">Data e hora de revelacao</span><input type="datetime-local" min={localDateTimeValue(new Date(Date.now() + 60_000))} value={revealAt} onChange={(event) => setRevealAt(event.target.value)} className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666]" /><span className="block text-xs text-[#666] mt-2">Use uma data pelo menos 1 minuto no futuro.</span></label>}
            {conditionType === 'GUARDIANS' && <div className="space-y-4">
              <div>
                <span className="block text-xs font-bold mb-2">Buscar guardioes</span>
                <div className="flex gap-2">
                  <input value={guardianSearch} onChange={(event) => setGuardianSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void handleGuardianSearch(); } }} placeholder="@usuario ou nome" className="min-w-0 flex-1 bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666]" />
                  <button type="button" onClick={() => void handleGuardianSearch()} disabled={guardianSearchLoading} className="px-4 py-3 rounded-xl bg-[#000666] text-white text-xs font-bold disabled:opacity-60">{guardianSearchLoading ? 'Buscando...' : 'Buscar'}</button>
                </div>
                <span className="block text-xs text-[#666] mt-2">Busque pelo @username simples ou pelo nome exibido.</span>
                {guardianSearchResults.length > 0 && <div className="mt-3 rounded-xl border border-[#e4e2de] overflow-hidden bg-white">
                  {guardianSearchResults.map((user) => <button key={user.id} type="button" onClick={() => addGuardian(user)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#f5f3ef] border-b border-[#f0efec] last:border-b-0"><div className="w-8 h-8 rounded-full bg-[#e0e0ff] text-[#000666] overflow-hidden flex items-center justify-center text-xs font-black">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user.displayName.charAt(0).toUpperCase()}</div><div className="min-w-0"><p className="text-sm font-bold truncate">{user.displayName}</p><p className="text-xs text-[#666] truncate">@{user.username.replace(/^@+/, '')}</p></div></button>)}
                </div>}
              </div>
              <div>
                <span className="block text-xs font-bold mb-2">Guardioes selecionados</span>
                {selectedGuardianUsers.length === 0 ? <p className="text-sm text-[#666] bg-[#f5f3ef] border border-dashed border-[#c6c5d4] rounded-xl p-4">Nenhum guardiao selecionado.</p> : <div className="space-y-2">{selectedGuardianUsers.map((guardian) => <div key={guardian.id} className="flex items-center justify-between gap-3 bg-[#f5f3ef] border border-[#e4e2de] rounded-xl p-3"><div className="min-w-0"><p className="text-sm font-bold truncate">{guardian.id === currentUser.id ? 'Você' : guardian.displayName}</p><p className="text-xs text-[#666] truncate">@{guardian.username.replace(/^@+/, '')}</p></div><button type="button" onClick={() => guardian.id === currentUser.id ? setIncludeCreatorAsGuardian(false) : removeGuardian(guardian.id)} className="text-xs font-bold text-[#8c1d18]">Remover</button></div>)}</div>}
                <span className="block text-xs text-[#666] mt-2">{guardianIds.length} guardiao(oes) selecionado(s).</span>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-[#d2d1ff] bg-[#f7f6fc] p-3 cursor-pointer"><input type="checkbox" checked={includeCreatorAsGuardian} onChange={(event) => setIncludeCreatorAsGuardian(event.target.checked)} className="mt-1" /><span><span className="block text-sm font-bold text-[#000666]">Eu também vou aprovar esta Intent</span><span className="block text-xs text-[#666] mt-1">Sua aprovação não é automática. Ela será solicitada após criar a Intent e contará para o quórum.</span></span></label>
              <PersonalContactListsPanel selectedUsers={selectedGuardianUsers} onSelectionChange={(users) => { setIncludeCreatorAsGuardian(users.some((user) => user.id === currentUser.id)); setSelectedGuardians(users.filter((user) => user.id !== currentUser.id)); }} />
              <label className="block"><span className="block text-xs font-bold mb-2">Quantos precisam aprovar?</span><input type="number" inputMode="numeric" min={1} max={Math.max(guardianIds.length, 1)} value={guardianApprovalGoal} onChange={(event) => setGuardianApprovalGoal(Number(event.target.value))} className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666]" /></label>
            </div>}
            <label className="block"><span className="flex justify-between text-xs font-bold mb-2"><span className="flex items-center gap-2"><Lock className="w-4 h-4" />O que sera revelado?</span><span className="text-[#888]">{revealContent.length}/10000</span></span><textarea value={revealContent} maxLength={10000} onChange={(event) => setRevealContent(event.target.value)} rows={4} placeholder="Este conteudo fica protegido ate a condicao ser cumprida." className="w-full bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#000666] resize-none" /></label>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-6">
          <div className="text-center"><h2 className="text-2xl font-black text-[#1b1c1a]">Tudo pronto?</h2><p className="text-sm text-[#454652] mt-2">Confira como sua Intent sera criada.</p></div>
          <article className="bg-white rounded-2xl border border-[#e4e2de] shadow-sm p-6">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-[#e0e0ff] flex items-center justify-center font-bold text-[#000666]">{currentUser.name.charAt(0).toUpperCase()}</div><div><p className="font-bold text-sm">{currentUser.name}</p><p className="text-xs text-[#666]">Agora mesmo · {selectedVisibility.title}</p></div></div>
            <div className="flex flex-wrap gap-2 mt-5"><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e0e0ff] text-[#000666] text-xs font-bold"><SelectedCategoryIcon className="w-3 h-3" /> {selectedCategory.label}</span><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${selectedVisibility.tone}`}><SelectedVisibilityIcon className="w-3 h-3" /> {selectedVisibility.badge}</span><span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f0efff] text-[#000666] text-xs font-bold"><SelectedConditionIcon className="w-3 h-3" /> {selectedCondition.title}</span></div>
            <h3 className="text-xl font-black mt-3">{title || 'Titulo da Intent'}</h3><p className="text-sm text-[#454652] mt-2 whitespace-pre-wrap">{story || 'Descricao da Intent'}</p>
            <div className="mt-5 rounded-xl bg-[#f5f3ef] p-4 flex items-center gap-3"><Lock className="w-5 h-5 text-[#000666]" /><div><p className="text-sm font-bold">{conditionType === 'SUPPORT' ? `0 de ${supportGoal} apoios` : conditionType === 'DATE' ? `Revela em ${new Date(revealAt).toLocaleString('pt-BR')}` : `0 de ${guardianApprovalGoal} guardioes`}</p><p className="text-xs text-[#666]">A revelacao permanece protegida ate a condicao.</p></div></div>
            <div className="grid sm:grid-cols-3 gap-3 mt-4 text-xs"><button type="button" onClick={() => setStep(1)} className="flex items-center justify-center gap-1 p-2 rounded-lg border border-[#e4e2de] font-bold text-[#000666]"><Edit3 className="w-3 h-3" />Editar ideia</button><button type="button" onClick={() => setStep(2)} className="flex items-center justify-center gap-1 p-2 rounded-lg border border-[#e4e2de] font-bold text-[#000666]"><Edit3 className="w-3 h-3" />Editar regra</button><span className="flex items-center justify-center gap-1 p-2 rounded-lg bg-[#e8f5e9] text-[#2e7d32] font-bold"><ShieldCheck className="w-3 h-3" />Pronto</span></div>
          </article>
        </section>
      )}

      {error && <div role="alert" className="mt-6 bg-[#ffdad6] text-[#8c1d18] rounded-xl px-4 py-3 text-sm font-semibold flex gap-2"><X className="w-4 h-4 shrink-0 mt-0.5 cursor-pointer" onClick={() => setError('')} /><span>{error}</span></div>}
      <footer className="mt-auto pt-8 flex items-center justify-between">
        <button onClick={handleBack} disabled={publishing} className="px-5 py-3 rounded-xl text-sm font-bold text-[#454652] hover:bg-[#eae8e4] disabled:opacity-50">{step === 1 ? 'Cancelar' : 'Voltar'}</button>
        <button onClick={handleNext} disabled={publishing} className="px-6 py-3 rounded-xl bg-[#000666] text-white text-sm font-bold flex items-center gap-2 hover:bg-[#000880] disabled:opacity-60">{publishing ? <><Sparkles className="w-4 h-4 animate-pulse" />Publicando...</> : step === 3 ? <><Check className="w-4 h-4" />Publicar Intent</> : <>Continuar<ArrowRight className="w-4 h-4" /></>}</button>
      </footer>
    </div>
  );
}

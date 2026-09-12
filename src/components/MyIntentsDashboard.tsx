import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Globe, Lock, Plus, RefreshCw, Users } from 'lucide-react';
import type { UserAccount } from '../types';
import { IntentApiError, listMyIntents, type ApiIntent, type IntentCategory } from '../services/intentApi';

interface MyIntentsDashboardProps { currentUser: UserAccount; onCreateNew: () => void; onSelectIntent: (id: string) => void }

const categoryLabels: Record<IntentCategory, string> = {
  SPORTS: 'Esportes', ENTERTAINMENT: 'Entretenimento', TECHNOLOGY: 'Tecnologia', EDUCATION: 'Educação',
  HEALTH_WELLNESS: 'Saúde e bem-estar', CAREER_BUSINESS: 'Carreira e negócios', COMMUNITY_CAUSES: 'Comunidade e causas',
  PERSONAL_LIFE: 'Vida pessoal', OTHER: 'Outros',
};

export function MyIntentsDashboard({ currentUser, onCreateNew, onSelectIntent }: MyIntentsDashboardProps) {
  const [intents, setIntents] = useState<ApiIntent[]>([]);
  const [filter, setFilter] = useState<'active' | 'realized'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadIntents() {
    setLoading(true); setError('');
    try { setIntents((await listMyIntents()).items); }
    catch (caught) { setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível carregar suas Intents.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadIntents(); }, []);
  const visible = useMemo(() => intents.filter((intent) => filter === 'active' ? intent.status === 'PUBLISHED' : intent.status === 'REALIZED'), [intents, filter]);
  const totalSupports = intents.reduce((sum, intent) => sum + intent.supportCount, 0);

  return <div className="w-full max-w-6xl mx-auto bg-[#fbf9f5] min-h-screen py-4 px-4 sm:px-6 antialiased font-sans">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"><div><h2 className="text-2xl font-black text-[#000666]">Minhas Intents</h2><p className="text-sm text-[#454652] mt-1">Acompanhe o progresso do que você colocou em movimento.</p></div><button onClick={onCreateNew} className="px-5 py-3 bg-[#000666] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"><Plus className="w-4 h-4"/>Criar nova</button></div>
    <div className="grid sm:grid-cols-3 gap-3 mb-6"><div className="bg-white border border-[#e4e2de] rounded-2xl p-4"><p className="text-xs text-[#666]">Intents publicadas</p><p className="text-2xl font-black mt-1">{intents.length}</p></div><div className="bg-white border border-[#e4e2de] rounded-2xl p-4"><p className="text-xs text-[#666]">Apoios recebidos</p><p className="text-2xl font-black mt-1">{totalSupports}</p></div><div className="bg-white border border-[#e4e2de] rounded-2xl p-4"><p className="text-xs text-[#666]">Realizadas</p><p className="text-2xl font-black mt-1">{intents.filter((item) => item.status === 'REALIZED').length}</p></div></div>
    <div className="flex gap-2 mb-5"><button onClick={() => setFilter('active')} className={`px-4 py-2 rounded-full text-xs font-bold ${filter === 'active' ? 'bg-[#000666] text-white' : 'bg-white border border-[#e4e2de]'}`}>Ativas</button><button onClick={() => setFilter('realized')} className={`px-4 py-2 rounded-full text-xs font-bold ${filter === 'realized' ? 'bg-[#000666] text-white' : 'bg-white border border-[#e4e2de]'}`}>Realizadas</button><button onClick={() => void loadIntents()} className="ml-auto p-2 rounded-full bg-white border border-[#e4e2de]" aria-label="Atualizar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/></button></div>
    {loading && <div className="bg-white border border-[#e4e2de] rounded-2xl p-10 text-center text-sm text-[#666]">Carregando suas Intents...</div>}
    {!loading && error && <div className="bg-[#ffdad6] text-[#8c1d18] rounded-2xl p-5 flex items-start gap-3"><AlertCircle className="w-5 h-5 shrink-0"/><div><p className="font-bold">Não foi possível carregar</p><p className="text-sm mt-1">{error}</p><button onClick={() => void loadIntents()} className="mt-3 underline text-sm font-bold">Tentar novamente</button></div></div>}
    {!loading && !error && visible.length === 0 && <div className="bg-white border-2 border-dashed border-[#c6c5d4] rounded-2xl p-10 text-center"><div className="w-12 h-12 rounded-full bg-[#e0e0ff] text-[#000666] flex items-center justify-center mx-auto"><Plus className="w-6 h-6"/></div><h3 className="font-bold mt-4">{filter === 'active' ? 'Nenhuma Intent ativa' : 'Nenhuma Intent realizada ainda'}</h3><p className="text-sm text-[#666] mt-2">{currentUser.name}, crie uma Intent simples e acompanhe os apoios aqui.</p>{filter === 'active' && <button onClick={onCreateNew} className="mt-5 px-5 py-3 bg-[#000666] text-white rounded-xl text-sm font-bold">Criar minha primeira Intent</button>}</div>}
    {!loading && !error && visible.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{visible.map((intent) => {
      const progress = Math.min(100, Math.round(intent.supportCount * 100 / intent.supportGoal));
      return <article key={intent.id} onClick={() => onSelectIntent(intent.id)} className="bg-white rounded-2xl border border-[#e4e2de] shadow-sm hover:shadow-md p-5 cursor-pointer">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${intent.status === 'REALIZED' ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#e0e0ff] text-[#000666]'}`}>
              {intent.status === 'REALIZED' ? 'Realizada' : 'Em andamento'}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              intent.visibility === 'PRIVATE'
                ? 'bg-[#fff3e0] text-[#e65100]'
                : intent.visibility === 'FOLLOWERS'
                ? 'bg-[#e8f5e9] text-[#2e7d32]'
                : 'bg-[#f0efff] text-[#000666]'
            }`}>
              {intent.visibility === 'PRIVATE' ? <><Lock className="w-2.5 h-2.5" />Privada</> : intent.visibility === 'FOLLOWERS' ? <><Users className="w-2.5 h-2.5" />Seguidores</> : <><Globe className="w-2.5 h-2.5" />Pública</>}
            </span>
          </div>
          <span className="text-xs text-[#666] font-medium">{categoryLabels[intent.category] || 'Outros'}</span>
        </div>
        <h3 className="font-bold mt-4 line-clamp-2">{intent.title}</h3><p className="text-sm text-[#666] mt-2 line-clamp-2">{intent.story}</p>
        <div className="mt-5"><div className="flex justify-between text-xs font-bold"><span>{intent.supportCount} de {intent.supportGoal} apoios</span><span className="text-[#006a62]">{progress}%</span></div><div className="h-2 bg-[#E0F2F1] rounded-full overflow-hidden mt-2"><div className="h-full bg-[#006a62]" style={{ width: `${progress}%` }}/></div></div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#f0efec] text-xs text-[#666]"><span className="flex items-center gap-1.5"><Users className="w-4 h-4"/>{intent.supportCount} mobilizados</span><span className="flex items-center gap-1.5"><Lock className="w-4 h-4"/>{intent.status === 'REALIZED' ? 'Revelada' : 'Protegida'}</span></div>
      </article>;
    })}</div>}
  </div>;
}

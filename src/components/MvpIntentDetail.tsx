import { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, Globe, Lock, Users } from 'lucide-react';
import type { UserAccount } from '../types';
import { getIntent, IntentApiError, removeIntentSupport, supportIntent, type ApiIntent, type IntentCategory } from '../services/intentApi';

interface MvpIntentDetailProps { intentId: string; currentUser: UserAccount; onBack: () => void }

const categoryLabels: Record<IntentCategory, string> = {
  SPORTS: 'Esportes', ENTERTAINMENT: 'Entretenimento', TECHNOLOGY: 'Tecnologia', EDUCATION: 'Educação',
  HEALTH_WELLNESS: 'Saúde e bem-estar', CAREER_BUSINESS: 'Carreira e negócios', COMMUNITY_CAUSES: 'Comunidade e causas',
  PERSONAL_LIFE: 'Vida pessoal', OTHER: 'Outros',
};

export function MvpIntentDetail({ intentId, currentUser, onBack }: MvpIntentDetailProps) {
  const [intent, setIntent] = useState<ApiIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [supporting, setSupporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setIntent(await getIntent(intentId)); }
    catch (caught) { setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível abrir esta Intent.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [intentId]);

  async function handleSupport() {
    setSupporting(true); setError(''); setNotice('');
    try {
      const result = intent?.viewerHasSupported
        ? await removeIntentSupport(intentId)
        : await supportIntent(intentId);
      setNotice(result.realizedNow ? 'Você realizou esta Intent!' : result.supported ? 'Seu apoio foi registrado.' : 'Seu apoio foi retirado.');
      setIntent(await getIntent(intentId));
    } catch (caught) {
      setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível registrar o apoio.');
    } finally { setSupporting(false); }
  }

  return <div className="max-w-2xl mx-auto w-full px-4 py-6 sm:py-8">
    <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-[#000666] mb-5"><ArrowLeft className="w-4 h-4"/>Voltar</button>
    {loading && <div className="bg-white border border-[#e4e2de] rounded-2xl p-10 text-center text-sm text-[#666]">Carregando Intent...</div>}
    {!loading && error && !intent && <div className="bg-[#ffdad6] text-[#8c1d18] rounded-2xl p-5 flex gap-3"><AlertCircle className="w-5 h-5"/><div><p className="font-bold">Não foi possível abrir</p><p className="text-sm mt-1">{error}</p></div></div>}
    {intent && (() => {
      const isMine = intent.creator.id === currentUser.id;
      const progress = Math.min(100, Math.round(intent.supportCount * 100 / intent.supportGoal));
      return <article className="bg-white border border-[#e4e2de] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-full bg-[#e0e0ff] text-[#000666] flex items-center justify-center font-black">{intent.creator.displayName.charAt(0).toUpperCase()}</div><div><p className="font-bold">{intent.creator.displayName}</p><p className="text-xs text-[#666]">@{intent.creator.username.replace(/^@+/, '')}</p></div></div>
        <div className="flex flex-wrap items-center gap-2 mt-5">
          <span className="px-2.5 py-1 rounded-full bg-[#f0efff] text-[#000666] text-xs font-bold">
            {categoryLabels[intent.category] || 'Outros'}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
            intent.visibility === 'PRIVATE'
              ? 'bg-[#fff3e0] text-[#e65100]'
              : intent.visibility === 'FOLLOWERS'
              ? 'bg-[#e8f5e9] text-[#2e7d32]'
              : 'bg-[#e0e0ff] text-[#000666]'
          }`}>
            {intent.visibility === 'PRIVATE' ? (
              <><Lock className="w-3 h-3" /> Privada (Cofre Pessoal)</>
            ) : intent.visibility === 'FOLLOWERS' ? (
              <><Users className="w-3 h-3" /> Somente Seguidores</>
            ) : (
              <><Globe className="w-3 h-3" /> Pública</>
            )}
          </span>
        </div>
        <h1 className="text-2xl font-black mt-3">{intent.title}</h1><p className="text-sm text-[#454652] mt-3 whitespace-pre-wrap">{intent.story}</p>
        <div className="mt-6"><div className="flex justify-between text-sm font-bold"><span>{intent.supportCount} de {intent.supportGoal} apoios</span><span>{progress}%</span></div><div className="h-3 bg-[#E0F2F1] rounded-full overflow-hidden mt-2"><div className="h-full bg-[#006a62]" style={{ width: `${progress}%` }}/></div></div>

        {notice && <div className="mt-5 p-4 bg-[#e8f5e9] text-[#2e7d32] rounded-xl flex items-center gap-2 text-sm font-bold"><CheckCircle2 className="w-5 h-5"/>{notice}</div>}
        {error && <div className="mt-5 p-4 bg-[#ffdad6] text-[#8c1d18] rounded-xl flex items-center gap-2 text-sm"><AlertCircle className="w-5 h-5"/>{error}</div>}

        {intent.status === 'REALIZED' ? <div className="mt-6 bg-[#e8f5e9] border border-[#a5d6a7] rounded-2xl p-5"><p className="text-xs font-bold text-[#2e7d32] flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/>INTENT REALIZADA</p><h2 className="font-black mt-3">A revelação</h2><p className="text-sm mt-2 whitespace-pre-wrap">{intent.revealContent || 'Conteúdo revelado.'}</p></div> : <div className="mt-6 bg-[#f5f3ef] rounded-2xl p-5 flex gap-3"><Lock className="w-5 h-5 text-[#000666] shrink-0"/><div><p className="font-bold text-sm">Revelação protegida</p><p className="text-xs text-[#666] mt-1">Será aberta automaticamente quando a meta for atingida.</p></div></div>}

        <div className="mt-6 pt-5 border-t border-[#e4e2de]">
          {isMine ? (
            <p className="text-sm text-[#666] text-center">
              {intent.visibility === 'PRIVATE'
                ? 'Esta Intent é privada e funciona como seu cofre pessoal. Ninguém além de você pode visualizá-la.'
                : 'Esta Intent é sua. O criador não pode apoiar a própria publicação.'}
            </p>
          ) : intent.visibility === 'PRIVATE' ? (
            <p className="text-sm text-red-600 font-bold text-center">Esta Intent é privada e não permite apoios externos.</p>
          ) : intent.status === 'PUBLISHED' ? (
            <button onClick={() => void handleSupport()} disabled={supporting} aria-pressed={Boolean(intent.viewerHasSupported)} className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 ${intent.viewerHasSupported ? 'bg-[#e8f5e9] border border-[#2e7d32] text-[#28642f]' : 'bg-[#000666] text-white'}`}>{intent.viewerHasSupported ? <CheckCircle2 className="w-4 h-4"/> : <Users className="w-4 h-4"/>}{supporting ? 'Atualizando...' : intent.viewerHasSupported ? 'Apoiado — clicar para retirar' : 'Apoiar esta Intent'}</button>
          ) : (
            <p className="text-sm text-[#2e7d32] font-bold text-center">{intent.viewerHasSupported ? 'Seu apoio está confirmado e registrado nesta realização.' : 'Esta Intent já foi realizada.'}</p>
          )}
        </div>
      </article>;
    })()}
  </div>;
}

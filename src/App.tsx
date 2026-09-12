import { useEffect, useRef, useState } from 'react';
import { Home, LogOut, PlusCircle, Target, UserRound } from 'lucide-react';
import type { UserAccount } from './types';
import { AuthGate } from './components/AuthGate';
import { CreationWizard } from './components/CreationWizard';
import { MyIntentsDashboard } from './components/MyIntentsDashboard';
import { MvpHomeFeed } from './components/MvpHomeFeed';
import { MvpIntentDetail } from './components/MvpIntentDetail';
import { MvpSocialProfile } from './components/MvpSocialProfile';
import { auth, onAuthStateChanged, signOut } from './utils/firebase';
import { logoutUser, setCurrentSessionUser } from './utils/storage';
import { IS_MOCK_MODE, syncAuthenticatedUser } from './services/intentApi';

type View = 'home' | 'create' | 'mine' | 'detail' | 'profile';
type SessionStatus = 'checking' | 'unauthenticated' | 'authenticated' | 'error';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking');
  const [sessionError, setSessionError] = useState('');
  const [view, setView] = useState<View>('home');
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const manualAuthentication = useRef(false);

  async function synchronizeSession() {
    if (!auth.currentUser) {
      setCurrentSessionUser(null); setCurrentUser(null); setSessionStatus('unauthenticated'); return;
    }
    setSessionStatus('checking'); setSessionError('');
    try {
      const account = await syncAuthenticatedUser(auth.currentUser);
      setCurrentUser(account); setSessionStatus('authenticated');
    } catch {
      setCurrentUser(null); setSessionError('Sua identidade foi confirmada, mas o perfil não pôde ser carregado.'); setSessionStatus('error');
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (manualAuthentication.current) return;
      if (!firebaseUser) {
        setCurrentSessionUser(null); setCurrentUser(null); setSessionStatus('unauthenticated'); return;
      }
      await synchronizeSession();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleLogout() {
    await signOut(auth);
    logoutUser(); setCurrentUser(null); setView('home'); setSessionStatus('unauthenticated');
  }

  function selectIntent(id: string) { setSelectedIntentId(id); setView('detail'); }
  function selectProfile(id: string) { setSelectedProfileId(id); setView('profile'); }

  if (sessionStatus === 'checking') return <div className="min-h-screen bg-[#f5f6fb] flex items-center justify-center"><div className="w-9 h-9 border-4 border-[#000666] border-t-transparent rounded-full animate-spin"/></div>;

  if (sessionStatus === 'error') return <div className="min-h-screen bg-[#f5f6fb] flex items-center justify-center p-4"><div className="max-w-md w-full bg-white border border-[#e4e2de] rounded-2xl p-6 text-center"><h1 className="font-black text-lg">Não foi possível abrir o Intent</h1><p className="text-sm text-[#666] mt-2">{sessionError}</p><button onClick={() => void synchronizeSession()} className="w-full mt-5 py-3 bg-[#000666] text-white rounded-xl text-sm font-bold">Tentar novamente</button><button onClick={() => void handleLogout()} className="mt-4 text-sm font-bold text-[#666]">Sair desta conta</button></div></div>;

  if (sessionStatus === 'unauthenticated' || !currentUser) return <AuthGate
    onAuthFlowStart={() => { manualAuthentication.current = true; }}
    onAuthFlowEnd={() => { manualAuthentication.current = false; }}
    onAuthenticated={(account) => { setCurrentUser(account); setSessionStatus('authenticated'); setView('home'); }}
  />;

  const items: Array<{ id: View; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'create', label: 'Criar', icon: PlusCircle },
    { id: 'mine', label: 'Minhas Intents', icon: Target },
    { id: 'profile', label: 'Perfil', icon: UserRound },
  ];

  return <div className="min-h-screen bg-[#f7f6fc] text-[#1b1c1a]">
    <header className="sticky top-0 z-30 bg-white border-b border-[#e4e2de]"><div className="max-w-5xl mx-auto h-16 px-4 flex items-center justify-between"><div className="flex items-center gap-2"><button onClick={() => setView('home')} className="text-xl font-black tracking-tight text-[#000666]">INTENT</button>{IS_MOCK_MODE && (<span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200" title="Modo Preview isolado ativo via VITE_USE_MOCKS. No ambiente local com PostgreSQL ou produção, mantenha VITE_USE_MOCKS=false">⚡ Preview / Mock</span>)}</div><nav className="hidden sm:flex items-center gap-1">{items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { if (id === 'profile') setSelectedProfileId(currentUser.id); setView(id); }} className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${view === id ? 'bg-[#e0e0ff] text-[#000666]' : 'text-[#666] hover:bg-[#f5f3ef]'}`}><Icon className="w-4 h-4"/>{label}</button>)}</nav><div className="flex items-center gap-3"><button onClick={() => selectProfile(currentUser.id)} className="hidden md:block text-right"><p className="text-xs font-bold">{currentUser.name}</p><p className="text-[11px] text-[#666]">@{currentUser.username.replace(/^@+/, '')}</p></button><button onClick={() => void handleLogout()} className="p-2 rounded-full hover:bg-[#f5f3ef] text-[#666]" aria-label="Sair"><LogOut className="w-5 h-5"/></button></div></div></header>

    <main className="pb-24 sm:pb-8">
      {view === 'home' && <MvpHomeFeed currentUser={currentUser} onCreate={() => setView('create')} onSelectIntent={selectIntent} onSelectProfile={selectProfile}/>} 
      {view === 'create' && <CreationWizard currentUser={currentUser} onCancel={() => setView('home')} onComplete={(created) => { setToast('Intent publicada com sucesso.'); setSelectedIntentId(created.id); setView('detail'); }}/>} 
      {view === 'mine' && <MyIntentsDashboard currentUser={currentUser} onCreateNew={() => setView('create')} onSelectIntent={selectIntent}/>} 
      {view === 'detail' && selectedIntentId && <MvpIntentDetail intentId={selectedIntentId} currentUser={currentUser} onBack={() => setView('home')}/>} 
      {view === 'profile' && <MvpSocialProfile userId={selectedProfileId || currentUser.id} currentUser={currentUser} onBack={() => setView('home')} onSelectIntent={selectIntent} onSelectProfile={selectProfile}/>} 
    </main>

    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#e4e2de] px-2 py-2 flex justify-around">{items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => { if (id === 'profile') setSelectedProfileId(currentUser.id); setView(id); }} className={`min-w-16 py-1 flex flex-col items-center gap-1 text-[10px] font-bold ${view === id ? 'text-[#000666]' : 'text-[#777]'}`}><Icon className="w-5 h-5"/>{label}</button>)}</nav>
    {toast && <div role="status" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1b1c1a] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-bold">{toast}</div>}
  </div>;
}

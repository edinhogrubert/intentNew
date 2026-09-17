import { useEffect, useRef, useState } from 'react';
import { Bell, Home, LogOut, PlusCircle, Target, UserRound } from 'lucide-react';
import type { UserAccount } from './types';
import { AuthGate } from './components/AuthGate';
import { CreationWizard } from './components/CreationWizard';
import { MyIntentsDashboard } from './components/MyIntentsDashboard';
import { MvpHomeFeed } from './components/MvpHomeFeed';
import { MvpIntentDetail } from './components/MvpIntentDetail';
import { MvpSocialProfile } from './components/MvpSocialProfile';
import { PublicUserProfile } from './components/PublicUserProfile';
import { NotificationsModal } from './components/NotificationsModal';
import { auth, onAuthStateChanged, signOut } from './utils/firebase';
import { logoutUser, setCurrentSessionUser } from './utils/storage';
import { getUnreadNotificationCount, syncAuthenticatedUser } from './services/intentApi';
import { parseInitialLocation, syncUrlLocation } from './utils/shareLink';

type View = 'home' | 'create' | 'mine' | 'detail' | 'profile' | 'public-profile';
type SessionStatus = 'checking' | 'unauthenticated' | 'authenticated' | 'error';

export default function App() {
  const initialTarget = useRef(parseInitialLocation());
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking');
  const [sessionError, setSessionError] = useState('');

  const [view, setView] = useState<View>(() => {
    if (initialTarget.current.type === 'intent' && initialTarget.current.id) return 'detail';
    if (initialTarget.current.type === 'user' && initialTarget.current.id) return 'public-profile';
    return 'home';
  });
  const [selectedIntentId, setSelectedIntentId] = useState<string | null>(() => {
    return initialTarget.current.type === 'intent' && initialTarget.current.id ? initialTarget.current.id : null;
  });
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => {
    return initialTarget.current.type === 'user' && initialTarget.current.id ? initialTarget.current.id : null;
  });

  const [toast, setToast] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const manualAuthentication = useRef(false);

  async function synchronizeSession() {
    if (!auth.currentUser) {
      setCurrentSessionUser(null); setCurrentUser(null); setSessionStatus('unauthenticated'); return;
    }
    setSessionStatus('checking'); setSessionError('');
    try {
      const account = await syncAuthenticatedUser(auth.currentUser);
      setCurrentUser(account);
      setSessionStatus('authenticated');

      // Se havia um link pendente inicial de intent ou perfil, garantir que abra nele
      if (initialTarget.current.type === 'intent' && initialTarget.current.id) {
        setSelectedIntentId(initialTarget.current.id);
        setView('detail');
        syncUrlLocation('detail', { intentId: initialTarget.current.id }, true);
      } else if (initialTarget.current.type === 'user' && initialTarget.current.id) {
        setSelectedProfileId(initialTarget.current.id);
        setView('public-profile');
        syncUrlLocation('public-profile', { userId: initialTarget.current.id }, true);
      }
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

  // Escutar eventos de navegação do navegador (botões Voltar/Avançar)
  useEffect(() => {
    function handlePopState() {
      const parsed = parseInitialLocation();
      if (parsed.type === 'intent' && parsed.id) {
        setSelectedIntentId(parsed.id);
        setView('detail');
      } else if (parsed.type === 'user' && parsed.id) {
        setSelectedProfileId(parsed.id);
        setView('public-profile');
      } else {
        setView('home');
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let active = true;
    if (sessionStatus !== 'authenticated' || !currentUser) {
      setUnreadCount(null);
      return () => { active = false; };
    }
    void getUnreadNotificationCount()
      .then((count) => { if (active) setUnreadCount(count); })
      .catch(() => { if (active) setUnreadCount(null); });
    return () => { active = false; };
  }, [sessionStatus, currentUser?.id]);

  async function handleLogout() {
    await signOut(auth);
    logoutUser();
    setCurrentUser(null);
    setUnreadCount(null);
    setNotificationsOpen(false);
    setView('home');
    setSessionStatus('unauthenticated');
    syncUrlLocation('home');
  }

  async function openNotifications() {
    setNotificationsOpen(true);
    try { setUnreadCount(await getUnreadNotificationCount()); }
    catch { setUnreadCount(null); }
  }

  function navigateToView(newView: View, targetId?: string | null) {
    if (newView === 'home' || newView === 'create' || newView === 'mine') {
      setView(newView);
      syncUrlLocation(newView);
    } else if (newView === 'detail' && targetId) {
      setSelectedIntentId(targetId);
      setView('detail');
      syncUrlLocation('detail', { intentId: targetId });
    } else if (newView === 'public-profile' && targetId) {
      setSelectedProfileId(targetId);
      setView('public-profile');
      syncUrlLocation('public-profile', { userId: targetId });
    } else if (newView === 'profile' && targetId) {
      setSelectedProfileId(targetId);
      setView('profile');
      syncUrlLocation('profile', { userId: targetId });
    }
  }

  function selectIntent(id: string) {
    navigateToView('detail', id);
  }

  function selectProfile(id: string) {
    navigateToView('profile', id);
  }

  function selectPublicProfile(id: string) {
    navigateToView('public-profile', id);
  }

  if (sessionStatus === 'checking') return <div className="min-h-screen bg-[#f5f6fb] flex items-center justify-center"><div className="w-9 h-9 border-4 border-[#000666] border-t-transparent rounded-full animate-spin"/></div>;

  if (sessionStatus === 'error') return <div className="min-h-screen bg-[#f5f6fb] flex items-center justify-center p-4"><div className="max-w-md w-full bg-white border border-[#e4e2de] rounded-2xl p-6 text-center"><h1 className="font-black text-lg">Não foi possível abrir o Intent</h1><p className="text-sm text-[#666] mt-2">{sessionError}</p><button onClick={() => void synchronizeSession()} className="w-full mt-5 py-3 bg-[#000666] text-white rounded-xl text-sm font-bold">Tentar novamente</button><button onClick={() => void handleLogout()} className="mt-4 text-sm font-bold text-[#666]">Sair desta conta</button></div></div>;

  if (sessionStatus === 'unauthenticated' || !currentUser) return <AuthGate
    onAuthFlowStart={() => { manualAuthentication.current = true; }}
    onAuthFlowEnd={() => { manualAuthentication.current = false; }}
    onAuthenticated={(account) => {
      setCurrentUser(account);
      setSessionStatus('authenticated');
      if (initialTarget.current.type === 'intent' && initialTarget.current.id) {
        navigateToView('detail', initialTarget.current.id);
      } else if (initialTarget.current.type === 'user' && initialTarget.current.id) {
        navigateToView('public-profile', initialTarget.current.id);
      } else {
        navigateToView('home');
      }
    }}
  />;

  const items: Array<{ id: View; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'create', label: 'Criar', icon: PlusCircle },
    { id: 'mine', label: 'Minhas Intents', icon: Target },
    { id: 'profile', label: 'Perfil', icon: UserRound },
  ];

  return <div className="min-h-screen bg-[#f7f6fc] text-[#1b1c1a]">
    <header className="sticky top-0 z-30 bg-white border-b border-[#e4e2de]">
      <div className="max-w-5xl mx-auto h-16 px-4 flex items-center justify-between">
        <button onClick={() => navigateToView('home')} className="text-xl font-black tracking-tight text-[#000666]">INTENT</button>
        <nav className="hidden sm:flex items-center gap-1">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                if (id === 'profile') {
                  navigateToView('profile', currentUser.id);
                } else {
                  navigateToView(id);
                }
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 ${view === id ? 'bg-[#e0e0ff] text-[#000666]' : 'text-[#666] hover:bg-[#f5f3ef]'}`}
            >
              <Icon className="w-4 h-4"/>{label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void openNotifications()} className="relative p-2 rounded-full hover:bg-[#f5f3ef] text-[#666]" aria-label={unreadCount && unreadCount > 0 ? `Abrir notificações: ${unreadCount} não lidas` : 'Abrir notificações'}>
            <Bell className="w-5 h-5"/>
            {unreadCount !== null && unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-[#ba1a1a] text-white text-[10px] font-black flex items-center justify-center border-2 border-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button onClick={() => navigateToView('profile', currentUser.id)} className="hidden md:block text-right">
            <p className="text-xs font-bold">{currentUser.name}</p>
            <p className="text-[11px] text-[#666]">@{currentUser.username.replace(/^@+/, '')}</p>
          </button>
          <button onClick={() => void handleLogout()} className="p-2 rounded-full hover:bg-[#f5f3ef] text-[#666]" aria-label="Sair"><LogOut className="w-5 h-5"/></button>
        </div>
      </div>
    </header>

    <main className="pb-24 sm:pb-8">
      {view === 'home' && <MvpHomeFeed currentUser={currentUser} onCreate={() => navigateToView('create')} onSelectIntent={selectIntent} onSelectProfile={selectPublicProfile}/>}
      {view === 'public-profile' && selectedProfileId && (
        <PublicUserProfile
          userId={selectedProfileId}
          currentUser={currentUser}
          onCurrentUserUpdated={setCurrentUser}
          onBack={() => navigateToView('home')}
          onSelectIntent={selectIntent}
        />
      )}
      {view === 'create' && <CreationWizard currentUser={currentUser} onCancel={() => navigateToView('home')} onComplete={(created) => { setToast('Intent publicada com sucesso.'); selectIntent(created.id); }}/>} 
      {view === 'mine' && <MyIntentsDashboard currentUser={currentUser} onCreateNew={() => navigateToView('create')} onSelectIntent={selectIntent}/>} 
      {view === 'detail' && selectedIntentId && <MvpIntentDetail intentId={selectedIntentId} currentUser={currentUser} onBack={() => navigateToView('home')}/>} 
      {view === 'profile' && <MvpSocialProfile
        userId={selectedProfileId || currentUser.id}
        currentUser={currentUser}
        onBack={() => navigateToView('home')}
        onSelectIntent={selectIntent}
        onSelectProfile={selectProfile}
        onCurrentUserUpdated={setCurrentUser}
      />}
    </main>

    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#e4e2de] px-2 py-2 flex justify-around">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => {
            if (id === 'profile') {
              navigateToView('profile', currentUser.id);
            } else {
              navigateToView(id);
            }
          }}
          className={`min-w-16 py-1 flex flex-col items-center gap-1 text-[10px] font-bold ${view === id ? 'text-[#000666]' : 'text-[#777]'}`}
        >
          <Icon className="w-5 h-5"/>{label}
        </button>
      ))}
    </nav>
    {toast && <div role="status" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#1b1c1a] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-bold">{toast}</div>}
    {notificationsOpen && <NotificationsModal
      onClose={() => setNotificationsOpen(false)}
      onRead={() => setUnreadCount((count) => count === null ? null : Math.max(0, count - 1))}
      onAllRead={() => setUnreadCount(0)}
      onSelectIntent={selectIntent}
    />}
  </div>;
}

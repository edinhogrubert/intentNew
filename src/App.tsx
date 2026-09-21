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
    { id: 'mine', label: 'Minhas Intents', icon: Target },
    { id: 'create', label: 'Criar', icon: PlusCircle },
    { id: 'profile', label: 'Perfil', icon: UserRound },
  ];

  return <div className="min-h-screen bg-[#faf8ff] text-[#191b23] flex flex-col md:flex-row antialiased">
    {/* Barra Lateral Fixa Minimalista (Estilo do Mockup - w-18 md:w-20) */}
    <nav className="hidden md:flex flex-col w-[76px] shrink-0 border-r border-[#e1e2ec] bg-white h-screen fixed left-0 top-0 z-40 items-center justify-between py-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-6 w-full">
        <button
          onClick={() => navigateToView('home')}
          className="font-display text-3xl font-extrabold text-[#003b9a] hover:scale-105 transition-transform"
          title="Intent OS"
        >
          I
        </button>

        {/* Links de Navegação */}
        <div className="flex flex-col items-center gap-3 w-full px-2">
          {items.map(({ id, label, icon: Icon }) => {
            const isActive = view === id;
            return (
              <button
                key={id}
                onClick={() => {
                  if (id === 'profile') {
                    navigateToView('profile', currentUser.id);
                  } else {
                    navigateToView(id);
                  }
                }}
                title={label}
                className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-[#dae1ff] text-[#003b9a] font-bold shadow-xs'
                    : 'text-[#434654] hover:bg-[#f3f3fd] hover:text-[#003b9a]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                {isActive && (
                  <span className="absolute -left-2 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[#003b9a]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ações Inferiores (Criar Rápido, Notificações, Perfil, Logout) */}
      <div className="flex flex-col items-center gap-3 w-full px-2">
        <button
          onClick={() => navigateToView('create')}
          title="Postar Intent"
          className="w-12 h-12 rounded-full bg-[#003b9a] text-white flex items-center justify-center shadow-md hover:bg-[#002f7d] hover:scale-105 transition-all"
        >
          <PlusCircle className="w-6 h-6" />
        </button>

        <button
          type="button"
          onClick={() => void openNotifications()}
          className="relative w-11 h-11 rounded-2xl flex items-center justify-center text-[#434654] hover:bg-[#f3f3fd] transition-colors"
          title="Notificações"
        >
          <Bell className="w-5 h-5" />
          {unreadCount !== null && unreadCount > 0 && (
            <span className="absolute 2 right-2 min-w-4 h-4 px-1 rounded-full bg-[#ba1a1a] text-white text-[9px] font-bold flex items-center justify-center border border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigateToView('profile', currentUser.id)}
          className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#dae1ff] hover:ring-2 hover:ring-[#003b9a] transition-all"
          title={`Perfil de ${currentUser.name}`}
        >
          {currentUser.avatarUrl ? (
            <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#dae1ff] text-[#003b9a] font-bold flex items-center justify-center text-xs">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          )}
        </button>

        <button
          onClick={() => void handleLogout()}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#737685] hover:text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors"
          title="Sair"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </nav>

    {/* Área de Conteúdo Principal (Deslocada apenas pela largura da barra lateral no desktop) */}
    <div className="flex-1 md:ml-[76px] flex flex-col min-h-screen">
      {/* Top Bar Mobile & Tablet */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#e1e2ec] px-4 py-3 flex items-center justify-between md:hidden">
        <button onClick={() => navigateToView('home')} className="font-display text-xl font-black text-[#003b9a]">
          INTENT
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openNotifications()}
            className="relative p-2 rounded-full text-[#434654] hover:bg-[#f3f3fd]"
          >
            <Bell className="w-5 h-5" />
            {unreadCount !== null && unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-[#ba1a1a] text-white text-[9px] font-bold flex items-center justify-center border border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigateToView('profile', currentUser.id)}
            className="w-8 h-8 rounded-full overflow-hidden border border-[#c3c6d6]"
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#dae1ff] text-[#003b9a] font-bold flex items-center justify-center text-xs">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-8">
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
        {view === 'detail' && selectedIntentId && (
          <MvpIntentDetail
            intentId={selectedIntentId}
            currentUser={currentUser}
            onBack={() => navigateToView('home')}
            onSelectProfile={selectPublicProfile}
            onSelectIntent={selectIntent}
          />
        )} 
        {view === 'profile' && <MvpSocialProfile
          userId={selectedProfileId || currentUser.id}
          currentUser={currentUser}
          onBack={() => navigateToView('home')}
          onSelectIntent={selectIntent}
          onSelectProfile={selectProfile}
          onCurrentUserUpdated={setCurrentUser}
        />}
      </main>
    </div>

    {/* Bottom Bar Mobile */}
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#e1e2ec] px-4 py-2 flex justify-around items-center">
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
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold py-1 px-3 rounded-xl transition-colors ${
            view === id ? 'text-[#003b9a] font-bold' : 'text-[#737685]'
          }`}
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </button>
      ))}
      <button
        onClick={() => navigateToView('create')}
        className="-mt-5 bg-[#003b9a] text-white p-3 rounded-full shadow-lg hover:scale-105 transition-transform"
        title="Criar Intent"
      >
        <PlusCircle className="w-6 h-6" />
      </button>
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

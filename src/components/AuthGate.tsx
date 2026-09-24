import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import type { UserAccount } from '../types';
import { auth, createUserWithEmailAndPassword, googleProvider, signInWithEmailAndPassword, signInWithPopup, signOut, updateCurrentUser, updateProfile, type FirebaseUser } from '../utils/firebase';
import { IntentApiError, syncAuthenticatedUser } from '../services/intentApi';

interface AuthGateProps {
  onAuthenticated: (user: UserAccount) => void;
  onAuthFlowStart: () => void;
  onAuthFlowEnd: () => void;
  onBackToLanding?: () => void;
  initialRegister?: boolean;
}

function authMessage(error: unknown) {
  if (error instanceof IntentApiError) return error.message;
  if (error instanceof GoogleLoginTimeoutError) {
    return 'O login com Google demorou mais que o esperado. Tente novamente ou entre com e-mail e senha.';
  }
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
    'auth/invalid-credential': 'E-mail ou senha inválidos.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/cancelled-popup-request': 'A tentativa anterior com Google foi cancelada. Você pode tentar novamente.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Você pode entrar com e-mail e senha.',
    'auth/popup-closed-by-user': 'Login com Google cancelado. Você pode tentar novamente ou entrar com e-mail e senha.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  };
  return messages[code] || 'Não foi possível concluir o acesso. Tente novamente.';
}

const GOOGLE_LOGIN_TIMEOUT_MS = 30_000;

class GoogleLoginTimeoutError extends Error {
  constructor() {
    super('GOOGLE_LOGIN_TIMEOUT');
    this.name = 'GoogleLoginTimeoutError';
  }
}

export function AuthGate({ onAuthenticated, onAuthFlowStart, onAuthFlowEnd, onBackToLanding, initialRegister = false }: AuthGateProps) {
  const [register, setRegister] = useState(initialRegister);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const googleAttempt = useRef(0);
  const activeFlows = useRef(0);
  const acceptedFirebaseUser = useRef<FirebaseUser | null>(null);
  const formFlowActive = useRef(false);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  function beginAuthFlow() {
    activeFlows.current += 1;
    if (activeFlows.current === 1) onAuthFlowStart();
  }

  function endAuthFlow() {
    activeFlows.current = Math.max(0, activeFlows.current - 1);
    if (activeFlows.current === 0) onAuthFlowEnd();
  }

  async function finish(firebaseUser: Parameters<typeof syncAuthenticatedUser>[0]) {
    acceptedFirebaseUser.current = firebaseUser;
    onAuthenticated(await syncAuthenticatedUser(firebaseUser));
  }

  async function googleLogin() {
    if (googleLoading || formLoading) return;

    const attempt = ++googleAttempt.current;
    setGoogleLoading(true);
    setError('');
    beginAuthFlow();

    let timeoutId: number | undefined;
    const popup = signInWithPopup(auth, googleProvider).then(async (credential) => {
      if (attempt !== googleAttempt.current) {
        const acceptedUser = acceptedFirebaseUser.current;
        if (acceptedUser && acceptedUser.uid !== credential.user.uid) {
          await updateCurrentUser(auth, acceptedUser);
        } else if (!acceptedUser && !formFlowActive.current && auth.currentUser?.uid === credential.user.uid) {
          await signOut(auth);
        }
        throw new Error('STALE_GOOGLE_ATTEMPT');
      }
      return credential;
    });

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        if (attempt === googleAttempt.current) googleAttempt.current += 1;
        reject(new GoogleLoginTimeoutError());
      }, GOOGLE_LOGIN_TIMEOUT_MS);
    });

    try {
      const credential = await Promise.race([popup, timeout]);
      await finish(credential.user);
    } catch (caught) {
      const staleAttempt = caught instanceof Error && caught.message === 'STALE_GOOGLE_ATTEMPT';
      if (!staleAttempt && mounted.current) setError(authMessage(caught));
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (mounted.current) setGoogleLoading(false);
      endAuthFlow();
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (formLoading) return;

    if (googleLoading) {
      googleAttempt.current += 1;
      setGoogleLoading(false);
    }
    formFlowActive.current = true;
    setFormLoading(true);
    setError('');
    beginAuthFlow();
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (register) {
        if (name.trim().length < 2) throw new Error('INVALID_NAME');
        const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await credential.user.getIdToken(true);
        await finish(credential.user);
      } else {
        const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
        await finish(credential.user);
      }
    } catch (caught) {
      setError(caught instanceof Error && caught.message === 'INVALID_NAME' ? 'Informe seu nome.' : authMessage(caught));
    } finally {
      formFlowActive.current = false;
      endAuthFlow();
      if (mounted.current) setFormLoading(false);
    }
  }

  return <div className="min-h-screen bg-[#f5f6fb] flex items-center justify-center p-4"><div className="w-full max-w-md bg-white border border-[#e4e2de] rounded-3xl shadow-lg p-7 sm:p-9">
    {onBackToLanding && (
      <button
        type="button"
        onClick={onBackToLanding}
        className="mb-5 text-xs font-bold text-[#555] hover:text-[#000666] flex items-center gap-1.5 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Voltar para apresentação</span>
      </button>
    )}
    <div className="w-12 h-12 rounded-2xl bg-[#000666] text-white flex items-center justify-center font-black mb-6">IT</div>
    <p className="text-xs font-bold text-[#000666] flex items-center gap-2"><ShieldCheck className="w-4 h-4"/>Acesso protegido</p><h1 className="text-2xl font-black mt-3">O que você quer fazer acontecer?</h1><p className="text-sm text-[#666] mt-2">Entre para criar, apoiar e acompanhar Intents reais.</p>
    <button onClick={() => void googleLogin()} disabled={googleLoading || formLoading} className="w-full mt-7 py-3.5 rounded-xl border border-[#c6c5d4] text-sm font-bold disabled:opacity-50">{googleLoading ? 'Aguardando o Google...' : 'Continuar com Google'}</button>
    <div className="flex items-center gap-3 my-5"><div className="h-px bg-[#e4e2de] flex-1"/><span className="text-[11px] text-[#777]">OU</span><div className="h-px bg-[#e4e2de] flex-1"/></div>
    <div className="flex bg-[#f5f3ef] p-1 rounded-xl mb-5"><button type="button" onClick={() => { setRegister(false); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${!register ? 'bg-white text-[#000666] shadow-sm' : 'text-[#666]'}`}><LogIn className="w-4 h-4"/>Entrar</button><button type="button" onClick={() => { setRegister(true); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${register ? 'bg-white text-[#000666] shadow-sm' : 'text-[#666]'}`}><UserPlus className="w-4 h-4"/>Criar conta</button></div>
    {error && <div role="alert" className="mb-4 p-3 bg-[#ffdad6] text-[#8c1d18] rounded-xl text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0"/>{error}</div>}
    <form onSubmit={submit} className="space-y-4">{register && <label className="block"><span className="block text-xs font-bold mb-1.5">Nome</span><input required minLength={2} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl text-sm outline-none focus:border-[#000666]"/></label>}<label className="block"><span className="block text-xs font-bold mb-1.5">E-mail</span><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl text-sm outline-none focus:border-[#000666]"/></label><label className="block"><span className="block text-xs font-bold mb-1.5">Senha</span><input required minLength={6} type="password" autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-[#fbf9f5] border border-[#c6c5d4] rounded-xl text-sm outline-none focus:border-[#000666]"/></label><button disabled={formLoading} className="w-full py-3.5 rounded-xl bg-[#000666] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">{formLoading ? 'Validando...' : googleLoading ? 'Entrar com e-mail' : register ? 'Criar conta' : 'Entrar'}<ArrowRight className="w-4 h-4"/></button></form>
    <p className="mt-5 text-[11px] text-[#666] flex items-center justify-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/>Sua senha não é armazenada pelo Intent.</p>
  </div></div>;
}

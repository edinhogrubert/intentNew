import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Pencil, RefreshCw, Share2, Target, UserMinus, UserPlus, Users } from 'lucide-react';
import type { UserAccount } from '../types';
import { followProfile, getSocialProfile, IntentApiError, unfollowProfile, type ApiSocialProfile } from '../services/intentApi';
import { copyToClipboard, getUserProfileShareUrl } from '../utils/shareLink';
import { MvpConnectionsList } from './MvpConnectionsList';
import { EditProfileModal } from './EditProfileModal';

interface MvpSocialProfileProps {
  userId: string;
  currentUser: UserAccount;
  onBack: () => void;
  onSelectIntent: (id: string) => void;
  onSelectProfile: (id: string) => void;
  onCurrentUserUpdated: (user: UserAccount) => void;
}

function memberSince(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(value));
}

export function MvpSocialProfile({ userId, currentUser, onBack, onSelectIntent, onSelectProfile, onCurrentUserUpdated }: MvpSocialProfileProps) {
  const [profile, setProfile] = useState<ApiSocialProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionsMode, setConnectionsMode] = useState<'followers' | 'following' | null>(null);
  const [editing, setEditing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const loadGeneration = useRef(0);

  async function handleCopyProfile() {
    const url = getUserProfileShareUrl(profile?.id || userId);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  }

  async function loadProfile() {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError('');
    try {
      const loadedProfile = await getSocialProfile(userId === currentUser.id ? undefined : userId);
      if (generation === loadGeneration.current) setProfile(loadedProfile);
    } catch (caught) {
      if (generation === loadGeneration.current) {
        setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível carregar o perfil.');
      }
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }

  useEffect(() => {
    setConnectionsMode(null);
    void loadProfile();
  }, [userId]);

  async function toggleFollow() {
    if (!profile || profile.isMe || relationshipLoading) return;
    setRelationshipLoading(true);
    setError('');
    try {
      setProfile(profile.isFollowing ? await unfollowProfile(profile.id) : await followProfile(profile.id));
    } catch (caught) {
      setError(caught instanceof IntentApiError ? caught.message : 'Não foi possível atualizar este vínculo.');
    } finally {
      setRelationshipLoading(false);
    }
  }

  function handleProfileSaved(updated: UserAccount) {
    setProfile((current) => current ? {
      ...current,
      displayName: updated.name,
      bio: updated.bio || null,
      avatarUrl: updated.avatarUrl || null,
    } : current);
    onCurrentUserUpdated(updated);
  }

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-12 text-center text-sm text-[#666]"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3"/>Carregando perfil real...</div>;

  if (!profile) return <div className="max-w-xl mx-auto px-4 py-10"><div className="bg-[#ffdad6] text-[#8c1d18] rounded-2xl p-5"><AlertCircle className="w-5 h-5 mb-2"/><p className="font-bold">Perfil indisponível</p><p className="text-sm mt-1">{error}</p><button onClick={onBack} className="mt-4 text-sm font-bold underline">Voltar</button></div></div>;

  if (connectionsMode) return <MvpConnectionsList profileId={profile.id} mode={connectionsMode} onBack={() => setConnectionsMode(null)} onSelectProfile={onSelectProfile}/>;

  const metrics: Array<{ label: string; value: number; connection?: 'followers' | 'following' }> = [
    { label: 'Intents', value: profile.stats.intentsCreated },
    { label: 'Seguidores', value: profile.stats.followersCount, connection: 'followers' },
    { label: 'Seguindo', value: profile.stats.followingCount, connection: 'following' },
    { label: 'Realizadas', value: profile.stats.intentsRealized },
    { label: 'Mobilização', value: profile.stats.supportsReceived },
    { label: 'Participação', value: profile.stats.supportsGiven },
  ];

  return <div className="max-w-5xl mx-auto w-full px-4 py-6 sm:py-8">
    <button onClick={onBack} className="mb-4 text-sm font-bold text-[#003b9a] flex items-center gap-2 hover:underline"><ArrowLeft className="w-4 h-4"/>Voltar</button>

    <section className="bg-white border border-[#e1e2ec]/70 rounded-3xl shadow-whisper overflow-hidden">
      <div className="h-28 bg-gradient-to-r from-[#003b9a] via-[#1155d0] to-[#80a4ff]"/>
      <div className="px-5 sm:px-8 pb-8">
        <div className="flex items-end justify-between gap-4 -mt-12">
          <div className="w-24 h-24 rounded-full border-4 border-white bg-[#faf8ff] text-[#003b9a] shadow-xs overflow-hidden flex items-center justify-center text-3xl font-extrabold">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover"/> : profile.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyProfile()}
              title="Copiar link do perfil público"
              className={`mb-1 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                copySuccess
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'border-[#c3c6d6] text-[#434654] bg-white hover:bg-[#f8faff]'
              }`}
            >
              {copySuccess ? <Check className="w-4 h-4 text-emerald-600"/> : <Share2 className="w-4 h-4"/>}
              {copySuccess ? 'Copiado!' : 'Compartilhar'}
            </button>

            {profile.isMe
              ? <button type="button" onClick={() => setEditing(true)} className="mb-1 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-[#c3c6d6] text-[#003b9a] bg-white hover:bg-[#f3f3fd] transition-colors"><Pencil className="w-4 h-4"/>Editar perfil</button>
              : <button onClick={() => void toggleFollow()} disabled={relationshipLoading} className={`mb-1 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-60 transition-colors ${profile.isFollowing ? 'border border-[#c3c6d6] text-[#ba1a1a] bg-white hover:bg-[#ffdad6]/30' : 'bg-[#003b9a] text-white hover:bg-[#002f7d]'}`}>{profile.isFollowing ? <UserMinus className="w-4 h-4"/> : <UserPlus className="w-4 h-4"/>}{relationshipLoading ? 'Atualizando...' : profile.isFollowing ? 'Deixar de seguir' : 'Seguir'}</button>}
          </div>
        </div>

        <h1 className="font-display text-2xl font-bold mt-4 text-[#191b23]">{profile.displayName}</h1>
        <p className="text-sm font-medium text-[#737685]">@{profile.username.replace(/^@+/, '')}</p>
        {profile.bio && <p className="text-sm mt-3 text-[#434654] leading-relaxed whitespace-pre-wrap">{profile.bio}</p>}
        <p className="text-xs text-[#737685] mt-3 flex items-center gap-2"><CalendarDays className="w-4 h-4"/>Membro desde {memberSince(profile.createdAt)}</p>

        {error && <div role="alert" className="mt-4 p-3 bg-[#ffdad6] text-[#93000a] rounded-xl text-xs">{error}</div>}

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-[#f8faff] border border-[#e1e2ec] rounded-2xl p-2 mt-6">
          {metrics.map((metric) => metric.connection
            ? <button type="button" key={metric.label} onClick={() => setConnectionsMode(metric.connection!)} className="bg-white rounded-xl px-2 py-3.5 text-center hover:bg-[#f3f3fd] transition-colors shadow-2xs" aria-label={`Abrir ${metric.label.toLowerCase()}`}><p className="font-display text-lg font-bold text-[#003b9a]">{metric.value}</p><p className="text-[11px] text-[#003b9a] font-bold mt-1 underline">{metric.label}</p></button>
            : <div key={metric.label} className="bg-white rounded-xl px-2 py-3.5 text-center shadow-2xs"><p className="font-display text-lg font-bold text-[#191b23]">{metric.value}</p><p className="text-[11px] text-[#737685] font-medium mt-1">{metric.label}</p></div>)}
        </div>

        <div className="mt-5 p-4 rounded-2xl bg-[#e8f5e9] flex items-center justify-between gap-4"><div><p className="text-xs font-bold text-[#10b981] flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4"/>Taxa de realização</p><p className="text-xs text-[#2e7d32] mt-1">Percentual real das Intents concluídas</p></div><strong className="font-display text-2xl text-[#10b981]">{profile.stats.realizationRate}%</strong></div>
      </div>
    </section>

    <section className="mt-7">
      <div className="flex items-center gap-2 mb-4"><Target className="w-5 h-5 text-[#003b9a]"/><div><h2 className="font-display text-base font-bold text-[#191b23]">Intents públicas recentes</h2><p className="text-xs text-[#737685]">Atividade real deste perfil</p></div></div>
      {profile.recentIntents.length === 0 && <div className="bg-white border border-[#e1e2ec] rounded-2xl p-7 text-center text-sm text-[#737685] shadow-whisper">Este perfil ainda não publicou Intents públicas.</div>}
      <div className="space-y-3">{profile.recentIntents.map((intent) => <button key={intent.id} onClick={() => onSelectIntent(intent.id)} className="w-full bg-white border border-[#e1e2ec]/70 rounded-2xl p-4 text-left flex items-center justify-between gap-4 hover:border-[#003b9a] hover:bg-[#f8faff] transition-colors shadow-whisper"><div className="min-w-0"><p className="font-bold text-[#191b23] truncate">{intent.title}</p><p className="text-xs text-[#737685] mt-1 flex items-center gap-1.5">{intent.status === 'REALIZED' ? <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]"/> : <Users className="w-3.5 h-3.5"/>}{intent.supportCount} de {intent.supportGoal} apoios · {intent.status === 'REALIZED' ? 'Realizada' : 'Em andamento'}</p></div><ArrowRight className="w-5 h-5 text-[#003b9a] shrink-0"/></button>)}</div>
    </section>
    {editing && <EditProfileModal
      user={currentUser}
      onClose={() => setEditing(false)}
      onSaved={handleProfileSaved}
    />}
  </div>;
}

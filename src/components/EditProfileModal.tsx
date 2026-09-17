import { useState, useEffect, type FormEvent } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  Image,
  LoaderCircle,
  Lock,
  Save,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { UserAccount } from '../types';
import { IntentApiError, updateUserProfile } from '../services/intentApi';

interface EditProfileModalProps {
  user: UserAccount;
  onClose: () => void;
  onSaved: (user: UserAccount) => void;
}

const AVATAR_PRESETS = [
  { id: 'avatar-1', label: 'Gradiente Índigo', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
  { id: 'avatar-2', label: 'Retrato Minimalista', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
  { id: 'avatar-3', label: 'Estilo Criativo', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80' },
  { id: 'avatar-4', label: 'Perfil Urbano', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80' },
];

export function EditProfileModal({ user, onClose, onSaved }: EditProfileModalProps) {
  const [displayName, setDisplayName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [avatarPreviewError, setAvatarPreviewError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fechar com ESC se não estiver salvando
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saving, onClose]);

  // Resetar erro de preview quando a URL mudar
  const handleAvatarUrlChange = (value: string) => {
    setAvatarUrl(value);
    setAvatarPreviewError(false);
  };

  const handleSelectPreset = (url: string) => {
    setAvatarUrl(url);
    setAvatarPreviewError(false);
  };

  const handleClearAvatar = () => {
    setAvatarUrl('');
    setAvatarPreviewError(false);
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const trimmedName = displayName.trim();
    if (trimmedName.length < 2) {
      setError('O nome de exibição deve conter pelo menos 2 caracteres.');
      return;
    }

    const trimmedBio = bio.trim();
    if (trimmedBio.length > 500) {
      setError('A bio não pode ultrapassar 500 caracteres.');
      return;
    }

    const trimmedAvatar = avatarUrl.trim();
    if (trimmedAvatar) {
      try {
        const parsed = new URL(trimmedAvatar);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setError('A URL do avatar deve começar com http:// ou https://');
          return;
        }
      } catch {
        setError('Por favor, informe uma URL válida para o avatar (ex: https://exemplo.com/foto.jpg)');
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const updated = await updateUserProfile({
        displayName: trimmedName,
        bio: trimmedBio || null,
        avatarUrl: trimmedAvatar || null,
      });
      onSaved(updated);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof IntentApiError
          ? caught.message
          : 'Não foi possível salvar seu perfil. Tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  }

  const initialLetter = displayName.trim() ? displayName.trim().charAt(0).toUpperCase() : user.name.charAt(0).toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-200"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border border-[#e4e2de] max-h-[92vh] flex flex-col"
      >
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-[#e4e2de] flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 id="edit-profile-title" className="text-lg font-black text-[#1b1c1a]">
              Editar perfil social
            </h2>
            <p className="text-xs text-[#666] mt-0.5">
              Atualize as informações visíveis publicamente no Intent.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="p-2 rounded-full text-[#666] hover:bg-[#f5f3ef] hover:text-[#1b1c1a] transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário com rolagem */}
        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="p-6 space-y-5 overflow-y-auto flex-1"
        >
          {/* Seção do Avatar com Preview */}
          <div className="bg-[#fbf9f5] border border-[#e4e2de] rounded-2xl p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#454652] mb-3">
              Foto de Perfil (Avatar)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Preview Circular */}
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-full border-2 border-[#c6c5d4] bg-[#e0e0ff] text-[#000666] overflow-hidden flex items-center justify-center text-2xl font-black shadow-inner">
                  {avatarUrl.trim() && !avatarPreviewError ? (
                    <img
                      src={avatarUrl.trim()}
                      alt="Prévia do avatar"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarPreviewError(true)}
                    />
                  ) : (
                    <span>{initialLetter}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-white border border-[#e4e2de] text-[#000666] shadow-xs">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Controles de URL e Ações */}
              <div className="w-full space-y-2">
                <div className="relative">
                  <input
                    id="profile-avatar-url"
                    type="url"
                    value={avatarUrl}
                    onChange={(event) => handleAvatarUrlChange(event.target.value)}
                    maxLength={2048}
                    placeholder="https://exemplo.com/avatar.jpg"
                    className="w-full rounded-xl border border-[#c6c5d4] bg-white px-3.5 py-2 text-xs sm:text-sm text-[#1b1c1a] focus:outline-none focus:ring-2 focus:ring-[#000666]"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[#666]">
                  <span>Link público direto para a imagem</span>
                  {avatarUrl.trim() && (
                    <button
                      type="button"
                      onClick={handleClearAvatar}
                      className="text-[#ba1a1a] hover:underline font-bold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Sugestões de Presets rápidos */}
            <div className="mt-3 pt-3 border-t border-[#e4e2de]">
              <p className="text-[11px] font-bold text-[#666] mb-2 flex items-center gap-1">
                <Image className="w-3 h-3" />
                Ou selecione uma sugestão:
              </p>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url)}
                    className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-transform hover:scale-105 shrink-0 ${
                      avatarUrl === preset.url
                        ? 'border-[#000666] ring-2 ring-[#000666]/30'
                        : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                    title={preset.label}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nome de usuário (Identificador Imutável) */}
          <div>
            <label
              htmlFor="profile-username"
              className="block text-sm font-bold text-[#1b1c1a] mb-1.5 flex items-center gap-1.5"
            >
              <span>Nome de usuário</span>
              <Lock className="w-3.5 h-3.5 text-[#666]" />
            </label>
            <div className="relative">
              <input
                id="profile-username"
                value={`@${user.username.replace(/^@+/, '')}`}
                readOnly
                aria-readonly="true"
                className="w-full rounded-xl border border-[#d6d4cf] bg-[#f5f3ef] px-3.5 py-2.5 text-sm text-[#666] font-medium cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-[#666] mt-1.5">
              O @username é o identificador único e fixo da sua conta.
            </p>
          </div>

          {/* Nome de Exibição */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile-display-name"
                className="block text-sm font-bold text-[#1b1c1a]"
              >
                Nome de exibição <span className="text-[#ba1a1a]">*</span>
              </label>
              <span className="text-xs text-[#666]">{displayName.length}/120</span>
            </div>
            <input
              id="profile-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
              minLength={2}
              maxLength={120}
              placeholder="Seu nome completo ou apelido"
              className="w-full rounded-xl border border-[#c6c5d4] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000666]"
            />
          </div>

          {/* Biografia */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="profile-bio"
                className="block text-sm font-bold text-[#1b1c1a]"
              >
                Biografia
              </label>
              <span className="text-xs text-[#666]">{bio.length}/500</span>
            </div>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Compartilhe suas paixões, metas e o que move suas intenções..."
              className="w-full resize-y rounded-xl border border-[#c6c5d4] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#000666]"
            />
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div
              role="alert"
              className="rounded-xl bg-[#ffdad6] p-3 text-sm text-[#8c1d18] flex items-start gap-2 border border-[#ffb4ab]"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Rodapé de Ações */}
          <div className="pt-3 border-t border-[#e4e2de] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-[#c6c5d4] text-sm font-bold text-[#454652] hover:bg-[#f5f3ef] transition-colors disabled:opacity-50 min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#000666] text-white text-sm font-bold flex items-center gap-2 hover:bg-[#1b237b] transition-colors shadow-sm disabled:opacity-60 min-h-[44px]"
            >
              {saving ? (
                <>
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

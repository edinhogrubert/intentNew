/**
 * Utilitários para geração de links compartilháveis, sincronização de URL
 * e cópia para a área de transferência no Intent OS.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ParsedLocationTarget {
  type: 'intent' | 'user' | 'home';
  id?: string;
}

/**
 * Valida se uma string possui o formato válido de UUID v4.
 */
export function isValidUuid(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
}

/**
 * Gera a URL absoluta e compartilhável para uma Intent específica.
 */
export function getIntentShareUrl(intentId: string): string {
  if (typeof window === 'undefined') return `?intent=${intentId}`;
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?intent=${encodeURIComponent(intentId)}`;
}

/**
 * Gera a URL absoluta e compartilhável para o perfil público de um usuário.
 */
export function getUserProfileShareUrl(userId: string): string {
  if (typeof window === 'undefined') return `?user=${userId}`;
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?user=${encodeURIComponent(userId)}`;
}

/**
 * Analisa a URL atual (query string e pathname) para identificar se há
 * uma Intent ou Usuário especificado para carregamento direto.
 */
export function parseInitialLocation(searchString?: string, pathnameString?: string): ParsedLocationTarget {
  if (typeof window === 'undefined' && !searchString && !pathnameString) {
    return { type: 'home' };
  }

  const search = searchString ?? (typeof window !== 'undefined' ? window.location.search : '');
  const pathname = pathnameString ?? (typeof window !== 'undefined' ? window.location.pathname : '');

  // 1. Verificação por parâmetros de busca (Query Params)
  const params = new URLSearchParams(search);
  const intentQuery = params.get('intent') || params.get('intent_id') || params.get('intentId');
  if (intentQuery && isValidUuid(intentQuery)) {
    return { type: 'intent', id: intentQuery.trim() };
  }

  const userQuery = params.get('user') || params.get('user_id') || params.get('userId') || params.get('profile') || params.get('profile_id');
  if (userQuery && isValidUuid(userQuery)) {
    return { type: 'user', id: userQuery.trim() };
  }

  // 2. Verificação por caminhos (Path Params, ex: /intent/:id ou /user/:id)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 2) {
    const [prefix, id] = segments;
    if ((prefix === 'intent' || prefix === 'intents') && isValidUuid(id)) {
      return { type: 'intent', id: id.trim() };
    }
    if ((prefix === 'user' || prefix === 'users' || prefix === 'profile' || prefix === 'profiles') && isValidUuid(id)) {
      return { type: 'user', id: id.trim() };
    }
  }

  return { type: 'home' };
}

/**
 * Atualiza a URL do navegador no histórico sem disparar recarregamento de página.
 */
export function syncUrlLocation(
  view: 'home' | 'create' | 'mine' | 'detail' | 'profile' | 'public-profile',
  params?: { intentId?: string | null; userId?: string | null },
  replace = false,
) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);

  // Limpar parâmetros anteriores de navegação
  url.searchParams.delete('intent');
  url.searchParams.delete('intent_id');
  url.searchParams.delete('intentId');
  url.searchParams.delete('user');
  url.searchParams.delete('user_id');
  url.searchParams.delete('userId');
  url.searchParams.delete('profile');
  url.searchParams.delete('profile_id');

  if (view === 'detail' && params?.intentId && isValidUuid(params.intentId)) {
    url.searchParams.set('intent', params.intentId);
  } else if ((view === 'public-profile' || view === 'profile') && params?.userId && isValidUuid(params.userId)) {
    url.searchParams.set('user', params.userId);
  }

  const newUrl = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : '') + url.hash;

  if (window.location.pathname + window.location.search !== newUrl) {
    if (replace) {
      window.history.replaceState({ view, ...params }, '', newUrl);
    } else {
      window.history.pushState({ view, ...params }, '', newUrl);
    }
  }
}

/**
 * Copia um texto para a área de transferência com suporte a fallback.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Tentar Clipboard API nativa
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Falhou ou permissão negada no iframe, prosseguir para o fallback
    }
  }

  // 2. Fallback baseado em elemento textarea temporário
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

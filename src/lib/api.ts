export type UserRole = 'admin' | 'accountant' | 'supervisor' | 'storekeeper' | 'driver';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: UserRole;
  status: string;
}

const TOKEN_KEY = 'ideal_token';
const USER_KEY = 'ideal_user';
const PERMS_KEY = 'ideal_perms';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveSession(token: string, user: AuthUser, permissions: string[]) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(PERMS_KEY, JSON.stringify(permissions));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PERMS_KEY);
}

export function getSavedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getSavedPermissions(): string[] {
  try {
    const raw = localStorage.getItem(PERMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function hasPerm(permissions: string[], perm: string): boolean {
  return permissions.includes('*') || permissions.includes(perm);
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`/api${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent('ideal-unauthorized'));
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new ApiError('Erreur réseau ou serveur indisponible.', res.status);
    }
    return (await res.text()) as unknown as T;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data?.error || 'Une erreur est survenue.', res.status, data);
  }
  return data as T;
}

export function downloadWithAuth(path: string, fallbackName: string) {
  const token = getToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `/api${path}${token ? `${sep}token=${encodeURIComponent(token)}` : ''}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function formatDA(amount: number | null | undefined, decimals = 0): string {
  const val = Number(amount || 0);
  return (
    val.toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + ' DA'
  );
}

export function formatNum(val: number | null | undefined, decimals = 0): string {
  return Number(val || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDateFr(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Propriétaire / Administrateur',
  accountant: 'Comptable',
  supervisor: 'Chef de chantier',
  storekeeper: 'Magasinier',
  driver: 'Chauffeur',
};

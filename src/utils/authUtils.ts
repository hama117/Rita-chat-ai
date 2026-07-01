const AUTH_KEY = 'gemini-chat-auth';
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

interface AuthSession {
  username: string;
  token: string;
  exp: number;       // サーバーが発行したトークン有効期限 (ms)
  timestamp: number; // 最後にアクティビティがあった時刻 (ms)
}

function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // 旧形式（token無し）は無効として扱う → 強制再ログイン
    if (!data || typeof data.token !== 'string' || typeof data.exp !== 'number') {
      return null;
    }
    return data as AuthSession;
  } catch {
    return null;
  }
}

export function isLoggedIn(): boolean {
  const session = getSession();
  if (!session) return false;
  if (!session.token) return false;
  if (session.exp <= Date.now()) return false;
  if (Date.now() - session.timestamp >= SESSION_TIMEOUT) return false;
  return true;
}

export function saveLoggedInUser(username: string, token: string, exp: number): void {
  const session: AuthSession = {
    username,
    token,
    exp,
    timestamp: Date.now(),
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function getAuthToken(): string | null {
  const session = getSession();
  if (!session) return null;
  if (session.exp <= Date.now()) return null;
  return session.token || null;
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function refreshLoginSession(): void {
  const session = getSession();
  if (!session) return;
  session.timestamp = Date.now();
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

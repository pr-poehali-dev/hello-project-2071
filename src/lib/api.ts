// API-клиент для КорпМессенджера

const URLS = {
  auth:     'https://functions.poehali.dev/8399d4e8-b98c-40b5-ac70-3a3efd19a67b',
  chats:    'https://functions.poehali.dev/e4fdcf79-f13d-41ea-be32-d7e991948593',
  messages: 'https://functions.poehali.dev/799a85d6-de39-46fa-b900-3cd65d25339c',
  users:    'https://functions.poehali.dev/684c0c08-bf0a-4088-9d27-afd1b20e1b21',
};

function getToken(): string {
  return localStorage.getItem('km-token') || '';
}

function setToken(t: string) {
  localStorage.setItem('km-token', t);
}

function clearToken() {
  localStorage.removeItem('km-token');
}

async function req<T = unknown>(
  base: string,
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (auth) headers['X-Auth-Token'] = getToken();

  const res = await fetch(`${base}${path}`, { ...options, headers });
  const data = await res.json();
  return data as T;
}

// ── AUTH ────────────────────────────────────────────────────────────────────

export const auth = {
  sendCode: (phone: string) =>
    req<{ ok: boolean; demo?: boolean; code?: string }>(
      URLS.auth, '/send-code', { method: 'POST', body: JSON.stringify({ phone }) }, false
    ),

  verify: (phone: string, code: string, name?: string, role?: string) =>
    req<{ ok: boolean; token?: string; need_name?: boolean; user?: ApiUser }>(
      URLS.auth, '/verify',
      { method: 'POST', body: JSON.stringify({ phone, code, name, role }) }, false
    ),

  me: () => req<{ ok: boolean; user?: ApiUser }>(URLS.auth, '/me'),

  updateMe: (data: Partial<ApiUser>) =>
    req<{ ok: boolean }>(URLS.auth, '/me', { method: 'PUT', body: JSON.stringify(data) }),

  setToken,
  getToken,
  clearToken,
  isLoggedIn: () => !!localStorage.getItem('km-token'),
};

// ── CHATS ───────────────────────────────────────────────────────────────────

export const chats = {
  list: () =>
    req<{ ok: boolean; chats?: ApiChat[] }>(URLS.chats, '/'),

  create: (data: { is_group?: boolean; name?: string; description?: string; member_ids?: number[] }) =>
    req<{ ok: boolean; chat_id?: number; existing?: boolean }>(
      URLS.chats, '/', { method: 'POST', body: JSON.stringify(data) }
    ),

  archive: (chatId: number) =>
    req<{ ok: boolean }>(URLS.chats, `/${chatId}/archive`, { method: 'POST' }),

  unarchive: (chatId: number) =>
    req<{ ok: boolean }>(URLS.chats, `/${chatId}/unarchive`, { method: 'POST' }),

  addMember: (chatId: number, userId: number) =>
    req<{ ok: boolean }>(URLS.chats, `/${chatId}/members`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }),

  removeMember: (chatId: number, userId: number) =>
    req<{ ok: boolean }>(URLS.chats, `/${chatId}/members`, { method: 'PUT', body: JSON.stringify({ user_id: userId }) }),

  update: (chatId: number, data: { name?: string; description?: string }) =>
    req<{ ok: boolean }>(URLS.chats, `/${chatId}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ── MESSAGES ─────────────────────────────────────────────────────────────────

export const messages = {
  list: (chatId: number, before?: string) =>
    req<{ ok: boolean; messages?: ApiMessage[] }>(
      URLS.messages, `/${chatId}${before ? `?before=${encodeURIComponent(before)}` : ''}`
    ),

  send: (chatId: number, data: {
    text?: string; media_type?: string; media_url?: string;
    media_name?: string; reply_to_id?: number;
  }) =>
    req<{ ok: boolean; id?: number; created_at?: string }>(
      URLS.messages, `/${chatId}`, { method: 'POST', body: JSON.stringify(data) }
    ),

  edit: (chatId: number, msgId: number, text: string) =>
    req<{ ok: boolean }>(
      URLS.messages, `/${chatId}/${msgId}`, { method: 'PUT', body: JSON.stringify({ text }) }
    ),

  remove: (chatId: number, msgId: number) =>
    req<{ ok: boolean }>(
      URLS.messages, `/${chatId}/${msgId}/remove`, { method: 'POST' }
    ),

  markRead: (chatId: number, msgId: number) =>
    req<{ ok: boolean }>(
      URLS.messages, `/${chatId}/${msgId}/read`, { method: 'POST' }
    ),
};

// ── USERS ────────────────────────────────────────────────────────────────────

export const users = {
  list: () => req<{ ok: boolean; users?: ApiUser[] }>(URLS.users, '/'),

  search: (q: string) =>
    req<{ ok: boolean; users?: ApiUser[] }>(URLS.users, `/search?q=${encodeURIComponent(q)}`),

  block: (userId: number) =>
    req<{ ok: boolean }>(URLS.users, '/block', { method: 'POST', body: JSON.stringify({ user_id: userId, action: 'block' }) }),

  unblock: (userId: number) =>
    req<{ ok: boolean }>(URLS.users, '/block', { method: 'POST', body: JSON.stringify({ user_id: userId, action: 'unblock' }) }),

  blocked: () => req<{ ok: boolean; users?: ApiUser[] }>(URLS.users, '/blocked'),
};

// ── ТИПЫ ─────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: number;
  phone: string;
  name: string;
  role: string;
  initials: string;
  avatar_url: string | null;
  status: string;
}

export interface ApiChat {
  id: number;
  name: string;
  is_group: boolean;
  avatar: string;
  description: string | null;
  created_at: string;
  last_message: string | null;
  last_time: string | null;
  unread: number;
  archived: boolean;
  members: ApiUser[];
}

export interface ApiMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  text: string;
  media_type: string | null;
  media_url: string | null;
  media_name: string | null;
  reply_to_id: number | null;
  removed: boolean;
  edited_at: string | null;
  created_at: string;
  sender_name: string;
  sender_initials: string;
  sender_avatar: string | null;
  reads: number;
}

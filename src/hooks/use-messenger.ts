import { useState, useEffect, useCallback, useRef } from 'react';
import { auth, chats as chatsApi, messages as messagesApi, users as usersApi, type ApiChat, type ApiMessage, type ApiUser } from '@/lib/api';

// Конвертируем время из ISO в HH:MM
function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Вчера';
  if (diffDays < 7) return d.toLocaleDateString('ru-RU', { weekday: 'short' });
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export interface UiMessage {
  id: number;
  text: string;
  time: string;
  mine: boolean;
  removed: boolean;
  edited: boolean;
  media?: { type: 'image' | 'video' | 'circle'; url: string; name?: string };
  replyToId?: number;
  senderName: string;
  senderInitials: string;
  senderAvatar: string | null;
  reads: number;
}

export interface UiChat {
  id: number;
  name: string;
  role: string;
  avatar: string;
  last: string;
  time: string;
  unread: number;
  online: boolean;
  group: boolean;
  archived: boolean;
  members: ApiUser[];
  messages: UiMessage[];
  loadingMessages: boolean;
}

function apiMsgToUi(m: ApiMessage, myId: number): UiMessage {
  return {
    id: m.id,
    text: m.removed ? '🗑 Сообщение удалено' : m.text,
    time: fmtTime(m.created_at),
    mine: m.sender_id === myId,
    removed: m.removed,
    edited: !!m.edited_at,
    media: m.media_type ? { type: m.media_type as 'image' | 'video' | 'circle', url: m.media_url!, name: m.media_name ?? undefined } : undefined,
    replyToId: m.reply_to_id ?? undefined,
    senderName: m.sender_name,
    senderInitials: m.sender_initials,
    senderAvatar: m.sender_avatar,
    reads: m.reads,
  };
}

function apiChatToUi(c: ApiChat, myId: number): UiChat {
  // Для личных чатов — имя собеседника
  const other = c.is_group ? null : c.members.find((m) => m.id !== myId);
  const name = c.is_group ? (c.name ?? 'Группа') : (other?.name ?? c.name ?? 'Чат');
  const avatar = c.is_group ? (c.avatar ?? '?') : (other?.initials ?? '?');
  const role = c.is_group
    ? `Группа · ${c.members.length} участн.`
    : (other?.role ?? '');

  return {
    id: c.id,
    name,
    role,
    avatar,
    last: c.last_message ?? '',
    time: fmtTime(c.last_time),
    unread: c.unread,
    online: !c.is_group && (other?.status === 'В сети' || false),
    group: c.is_group,
    archived: c.archived,
    members: c.members,
    messages: [],
    loadingMessages: false,
  };
}

export function useMessenger() {
  const [myUser, setMyUser] = useState<ApiUser | null>(null);
  const [allUsers, setAllUsers] = useState<ApiUser[]>([]);
  const [chatList, setChatList] = useState<UiChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myId = myUser?.id ?? 0;

  // ── Загрузка профиля и чатов ─────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!auth.isLoggedIn()) return;
    try {
      const [meRes, chatsRes, usersRes] = await Promise.all([
        auth.me(),
        chatsApi.list(),
        usersApi.list(),
      ]);
      if (meRes.ok && meRes.user) setMyUser(meRes.user);
      if (usersRes.ok && usersRes.users) setAllUsers(usersRes.users);
      if (chatsRes.ok && chatsRes.chats) {
        const uid = meRes.user?.id ?? 0;
        setChatList((prev) =>
          (chatsRes.chats ?? []).map((c) => {
            const ui = apiChatToUi(c, uid);
            const existing = prev.find((p) => p.id === c.id);
            return existing ? { ...ui, messages: existing.messages, loadingMessages: existing.loadingMessages } : ui;
          })
        );
      }
    } catch (e) {
      setError('Ошибка соединения');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    // Поллинг каждые 5 секунд для обновления чатов
    pollRef.current = setInterval(loadAll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadAll]);

  // ── Загрузка сообщений чата ──────────────────────────────────────────────

  const loadMessages = useCallback(async (chatId: number) => {
    setChatList((prev) =>
      prev.map((c) => c.id === chatId ? { ...c, loadingMessages: true } : c)
    );
    try {
      const res = await messagesApi.list(chatId);
      if (res.ok && res.messages) {
        const msgs = res.messages.map((m) => apiMsgToUi(m, myId));
        setChatList((prev) =>
          prev.map((c) => c.id === chatId
            ? { ...c, messages: msgs, loadingMessages: false, unread: 0 }
            : c
          )
        );
      }
    } catch (e) {
      console.error(e);
      setChatList((prev) => prev.map((c) => c.id === chatId ? { ...c, loadingMessages: false } : c));
    }
  }, [myId]);

  // ── Отправка сообщения ────────────────────────────────────────────────────

  const sendMessage = useCallback(async (
    chatId: number,
    text: string,
    media?: { type: string; url: string; name?: string },
    replyToId?: number
  ) => {
    const t = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    // Оптимистичное добавление
    const tempId = Date.now();
    const tempMsg: UiMessage = {
      id: tempId,
      text: text || '',
      time: t,
      mine: true,
      removed: false,
      edited: false,
      media: media as UiMessage['media'],
      replyToId,
      senderName: myUser?.name ?? '',
      senderInitials: myUser?.initials ?? '',
      senderAvatar: myUser?.avatar_url ?? null,
      reads: 1,
    };
    setChatList((prev) =>
      prev.map((c) => c.id === chatId
        ? { ...c, messages: [...c.messages, tempMsg], last: text || (media ? '📎 Вложение' : ''), time: t }
        : c
      )
    );

    try {
      await messagesApi.send(chatId, {
        text,
        media_type: media?.type,
        media_url: media?.url,
        media_name: media?.name,
        reply_to_id: replyToId,
      });
      // Перезагружаем сообщения для получения реального id
      loadMessages(chatId);
    } catch (e) {
      console.error(e);
    }
  }, [myId, myUser, loadMessages]);

  // ── Архив ─────────────────────────────────────────────────────────────────

  const archiveChat = useCallback(async (chatId: number) => {
    setChatList((prev) => prev.map((c) => c.id === chatId ? { ...c, archived: true } : c));
    await chatsApi.archive(chatId);
  }, []);

  const unarchiveChat = useCallback(async (chatId: number) => {
    setChatList((prev) => prev.map((c) => c.id === chatId ? { ...c, archived: false } : c));
    await chatsApi.unarchive(chatId);
  }, []);

  // ── Удаление (локальное — чат остаётся в БД) ─────────────────────────────

  const deleteChat = useCallback((chatId: number) => {
    setChatList((prev) => prev.filter((c) => c.id !== chatId));
  }, []);

  // ── Создание чата/группы ──────────────────────────────────────────────────

  const createChat = useCallback(async (data: {
    is_group?: boolean; name?: string; description?: string; member_ids?: number[];
  }) => {
    const res = await chatsApi.create(data);
    if (res.ok) await loadAll();
    return res;
  }, [loadAll]);

  // ── Участники ─────────────────────────────────────────────────────────────

  const addMember = useCallback(async (chatId: number, userId: number) => {
    await chatsApi.addMember(chatId, userId);
    await loadAll();
  }, [loadAll]);

  const removeMember = useCallback(async (chatId: number, userId: number) => {
    await chatsApi.removeMember(chatId, userId);
    await loadAll();
  }, [loadAll]);

  // ── Обновление профиля ────────────────────────────────────────────────────

  const updateProfile = useCallback(async (data: Partial<ApiUser>) => {
    await auth.updateMe(data);
    const res = await auth.me();
    if (res.ok && res.user) setMyUser(res.user);
  }, []);

  return {
    myUser, allUsers, chatList, setChatList,
    loading, error,
    loadMessages, sendMessage,
    archiveChat, unarchiveChat, deleteChat,
    createChat, addMember, removeMember,
    updateProfile, reload: loadAll,
  };
}

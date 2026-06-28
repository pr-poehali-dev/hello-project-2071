import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { useNotifications, SOUNDS, type SoundId } from '@/hooks/use-notifications';
import CallScreen from '@/components/CallScreen';
import { useMessenger } from '@/hooks/use-messenger';
import { auth } from '@/lib/api';

// ─── настройки внешнего вида ────────────────────────────────────────────────

type ThemeMode = 'light' | 'dark';
type FontSize  = 'sm' | 'md' | 'lg' | 'xl';

interface AppSettings {
  theme: ThemeMode;
  fontSize: FontSize;
  wallpaper: string | null;
}

const WALLPAPERS = [
  { id: 'none',     label: 'Без фона',      url: null },
  { id: 'navy',     label: 'Гексагоны',     url: 'https://cdn.poehali.dev/projects/73230b07-9367-48b8-9d97-33cda4a6a593/files/0f7cb25b-7426-4269-86a0-718b2daf4731.jpg' },
  { id: 'water',    label: 'Акварель',       url: 'https://cdn.poehali.dev/projects/73230b07-9367-48b8-9d97-33cda4a6a593/files/06083f0d-b00c-44d7-bea2-809f6ed517ad.jpg' },
  { id: 'circuit',  label: 'Схема',          url: 'https://cdn.poehali.dev/projects/73230b07-9367-48b8-9d97-33cda4a6a593/files/18b12cec-0033-47fb-8132-7ff3179c0cbe.jpg' },
  { id: 'linen',    label: 'Лён',            url: 'https://cdn.poehali.dev/projects/73230b07-9367-48b8-9d97-33cda4a6a593/files/8b9123e3-e590-4456-8c32-63ba17c5871f.jpg' },
  { id: 'forest',   label: 'Листья',         url: 'https://cdn.poehali.dev/projects/73230b07-9367-48b8-9d97-33cda4a6a593/files/4a70d2b1-a13f-45f6-adbf-d42a323ab136.jpg' },
  { id: 'blue',     label: 'Градиент',       url: 'https://cdn.poehali.dev/projects/73230b07-9367-48b8-9d97-33cda4a6a593/files/1e8ae987-b0bb-4568-b888-6c6c99ed6046.jpg' },
];

const FONT_SIZES: { id: FontSize; label: string; size: string }[] = [
  { id: 'sm', label: 'Маленький', size: '12px' },
  { id: 'md', label: 'Средний',   size: '14px' },
  { id: 'lg', label: 'Крупный',   size: '16px' },
  { id: 'xl', label: 'Очень крупный', size: '18px' },
];

const DEFAULT_SETTINGS: AppSettings = { theme: 'light', fontSize: 'md', wallpaper: null };

function applySettings(s: AppSettings) {
  const root = document.documentElement;
  root.classList.toggle('dark', s.theme === 'dark');
  root.setAttribute('data-fontsize', s.fontSize);
}

// ─── типы ────────────────────────────────────────────────────────────────────

interface MediaAttachment {
  type: 'image' | 'video' | 'circle';
  url: string;
  name?: string;
}

interface Message {
  id: number;
  text: string;
  time: string;
  mine: boolean;
  media?: MediaAttachment;
}

interface Contact {
  id: number;
  name: string;
  role: string;
  avatar: string;   // инициалы или data-url фото
  online: boolean;
}

interface Chat {
  id: number;
  name: string;
  role: string;
  avatar: string;
  last: string;
  time: string;
  unread: number;
  online: boolean;
  group?: boolean;
  memberIds?: number[];
  archived?: boolean;
  messages: Message[];
}

interface UserProfile {
  name: string;
  role: string;
  initials: string;
  avatarUrl: string | null;
  status: string;
}

// ─── данные ──────────────────────────────────────────────────────────────────

const ALL_CONTACTS: Contact[] = [
  { id: 1, name: 'Елена Воронцова',  role: 'Финансовый директор',        avatar: 'ЕВ', online: true  },
  { id: 2, name: 'Дмитрий Соколов',  role: 'Руководитель отдела продаж', avatar: 'ДС', online: false },
  { id: 3, name: 'Анна Кузнецова',   role: 'HR-директор',                avatar: 'АК', online: false },
  { id: 4, name: 'Алексей Громов',   role: 'Технический директор',       avatar: 'АГ', online: true  },
  { id: 5, name: 'Мария Лебедева',   role: 'Руководитель маркетинга',    avatar: 'МЛ', online: true  },
  { id: 6, name: 'Сергей Тихонов',   role: 'Юрист',                      avatar: 'СТ', online: false },
  { id: 7, name: 'Ольга Семёнова',   role: 'Бухгалтер',                  avatar: 'ОС', online: false },
  { id: 8, name: 'Павел Морозов',    role: 'Менеджер проекта',           avatar: 'ПМ', online: true  },
];

const INITIAL_CHATS: Chat[] = [
  {
    id: 1, name: 'Совет директоров', role: 'Группа', avatar: 'СД',
    last: 'Алексей: Документы согласованы…', time: '14:32', unread: 3, online: true,
    group: true, memberIds: [1, 4, 5],
    messages: [
      { id: 1, text: 'Коллеги, добрый день. Прошу ознакомиться с обновлённым планом на Q3.', time: '14:20', mine: false },
      { id: 2, text: 'Принято. Просмотрю до конца дня.', time: '14:25', mine: true },
      { id: 3, text: 'Документы согласованы, отправляю финальную версию.', time: '14:32', mine: false },
    ],
  },
  {
    id: 2, name: 'Елена Воронцова', role: 'Финансовый директор', avatar: 'ЕВ',
    last: 'Отчёт по бюджету готов', time: '13:10', unread: 0, online: true,
    messages: [
      { id: 1, text: 'Иван, отчёт по бюджету готов к защите.', time: '13:08', mine: false },
      { id: 2, text: 'Отлично, назначим встречу на завтра.', time: '13:10', mine: true },
    ],
  },
  {
    id: 3, name: 'Дмитрий Соколов', role: 'Руководитель отдела продаж', avatar: 'ДС',
    last: 'Вы: Согласен, обсудим на созвоне', time: 'Вчера', unread: 0, online: false,
    messages: [
      { id: 1, text: 'Предлагаю пересмотреть условия по ключевому клиенту.', time: '11:40', mine: false },
      { id: 2, text: 'Согласен, обсудим на созвоне.', time: '11:45', mine: true },
    ],
  },
  {
    id: 4, name: 'Отдел маркетинга', role: 'Группа', avatar: 'ОМ',
    last: 'Мария: Кампания запущена', time: 'Вчера', unread: 0, online: false,
    group: true, memberIds: [5, 2, 7],
    messages: [
      { id: 1, text: 'Кампания запущена по графику. Первые метрики завтра.', time: '18:00', mine: false },
    ],
  },
  {
    id: 5, name: 'Анна Кузнецова', role: 'HR-директор', avatar: 'АК',
    last: 'Кандидат выходит с понедельника', time: 'Пн', unread: 0, online: false,
    messages: [
      { id: 1, text: 'Кандидат подтвердил выход с понедельника.', time: '09:15', mine: false },
    ],
  },
];

const DEFAULT_PROFILE: UserProfile = {
  name: 'Иван Петров',
  role: 'Генеральный директор',
  initials: 'ИП',
  avatarUrl: null,
  status: 'В сети',
};

// ─── вспомогательные ────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}
function nowTime() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
function formatBytes(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} КБ` : `${(b / 1024 / 1024).toFixed(1)} МБ`;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ url, initials, size = 10, className = '' }: { url: string | null; initials: string; size?: number; className?: string }) {
  const sz = `w-${size} h-${size}`;
  if (url) return <img src={url} alt={initials} className={`${sz} rounded-md object-cover shrink-0 ${className}`} />;
  return <div className={`${sz} rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0 ${className}`}>{initials}</div>;
}

// ─── ProfilePanel ────────────────────────────────────────────────────────────

function ProfilePanel({ profile, onUpdate, onClose }: {
  profile: UserProfile;
  onUpdate: (p: UserProfile) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role);
  const [status, setStatus] = useState(profile.status);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const save = () => {
    onUpdate({ name: name.trim() || profile.name, role: role.trim() || profile.role, initials: getInitials(name.trim() || profile.name), avatarUrl, status });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="font-semibold text-base">Мой профиль</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>
        <div className="px-6 py-6 space-y-5">
          {/* Аватар */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-20 h-20 rounded-xl object-cover" />
                : <div className="w-20 h-20 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold">{getInitials(name || profile.name)}</div>
              }
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-opacity">
                <Icon name="Camera" size={14} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
            <div>
              <p className="font-medium text-sm">{name || profile.name}</p>
              <p className="text-xs text-muted-foreground">{role || profile.role}</p>
              <button onClick={() => fileRef.current?.click()} className="text-xs text-primary mt-1 hover:underline">
                Изменить фото
              </button>
            </div>
          </div>

          {/* Поля */}
          {[
            { label: 'Имя и фамилия', value: name, set: setName, placeholder: 'Иван Петров' },
            { label: 'Должность', value: role, set: setRole, placeholder: 'Генеральный директор' },
            { label: 'Статус', value: status, set: setStatus, placeholder: 'В сети' },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-sm font-medium block mb-1.5">{f.label}</label>
              <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder}
                className="w-full h-10 px-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:bg-secondary transition-colors">Отмена</button>
          <button onClick={save} className="h-9 px-5 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium">Сохранить</button>
        </div>
      </div>
    </div>
  );
}

// ─── VideoCircle ─────────────────────────────────────────────────────────────

function VideoCircleRecorder({ onSend, onClose }: { onSend: (url: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      })
      .catch(() => setError('Нет доступа к камере'));
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startRec = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current);
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setPreview(URL.createObjectURL(blob));
    };
    mr.start();
    mediaRef.current = mr;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => { if (s >= 59) { stopRec(); return s; } return s + 1; }), 1000);
  };

  const stopRec = () => {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const send = () => {
    if (preview) { onSend(preview); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-80 mx-4 animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Видео-кружок</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary"><Icon name="X" size={16} /></button>
        </div>
        <div className="p-5 flex flex-col items-center gap-4">
          {error ? (
            <div className="text-center text-sm text-muted-foreground py-8 space-y-2">
              <Icon name="CameraOff" size={36} className="mx-auto opacity-30" />
              <p>{error}</p>
            </div>
          ) : preview ? (
            <>
              <video src={preview} controls className="w-52 h-52 rounded-full object-cover border-4 border-primary" />
              <div className="flex gap-2 w-full">
                <button onClick={() => setPreview(null)} className="flex-1 h-10 rounded-md bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors">Переснять</button>
                <button onClick={send} className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
                  <Icon name="Send" size={15} /> Отправить
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <video ref={videoRef} muted playsInline className="w-52 h-52 rounded-full object-cover border-4 border-border bg-black" />
                {recording && (
                  <div className="absolute top-2 right-2 bg-destructive text-white text-[11px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
                  </div>
                )}
              </div>
              <button
                onClick={recording ? stopRec : startRec}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-md ${recording ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground'}`}>
                <Icon name={recording ? 'Square' : 'Video'} size={22} />
              </button>
              <p className="text-xs text-muted-foreground">{recording ? 'Нажмите для остановки' : 'Нажмите для записи'}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

// Симуляция входящих сообщений
const INCOMING: { chatId: number; sender: string; text: string; delay: number }[] = [
  { chatId: 2, sender: 'Елена Воронцова', text: 'Иван, когда удобно созвониться?', delay: 18000 },
  { chatId: 1, sender: 'Алексей Громов',  text: 'Коллеги, прошу подтвердить присутствие на совещании.', delay: 35000 },
  { chatId: 3, sender: 'Дмитрий Соколов', text: 'Я отправил материалы на почту.', delay: 52000 },
];

export default function Index() {
  const navigate = useNavigate();
  const { permission, requestPermission, notify, soundEnabled, setSoundEnabled, soundId, setSoundId, playSound } = useNotifications();
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('km-settings');
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) as AppSettings };
    } catch (e) { console.warn('settings load failed', e); }
    return DEFAULT_SETTINGS;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'appearance' | 'sound'>('appearance');
  const wallpaperInputRef = useRef<HTMLInputElement>(null);

  // Применяем и сохраняем настройки при изменении
  useEffect(() => {
    applySettings(settings);
    try { localStorage.setItem('km-settings', JSON.stringify(settings)); } catch (e) { console.warn(e); }
  }, [settings]);

  const updateSettings = (patch: Partial<AppSettings>) =>
    setSettings((prev) => { const next = { ...prev, ...patch }; applySettings(next); return next; });

  // Редирект на логин если нет токена
  useEffect(() => {
    if (!auth.isLoggedIn()) navigate('/login');
  }, [navigate]);

  // ── API ──────────────────────────────────────────────────────────────────
  const {
    myUser, allUsers, chatList, setChatList,
    loading: apiLoading,
    loadMessages, sendMessage: apiSendMessage,
    archiveChat: apiArchive, unarchiveChat: apiUnarchive, deleteChat: apiDeleteChat,
    createChat, addMember: apiAddMember, removeMember: apiRemoveMember,
    updateProfile,
  } = useMessenger();

  // Используем реальные чаты если загружены, иначе демо
  const apiReady = !apiLoading && chatList.length > 0;
  const chats = apiReady ? chatList : INITIAL_CHATS;
  const setChats = setChatList as React.Dispatch<React.SetStateAction<typeof chatList>>;

  const [activeId, setActiveId] = useState<number>(0);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'chats' | 'archive'>('chats');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: number } | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showCircle, setShowCircle] = useState(false);
  const [lightbox, setLightbox] = useState<MediaAttachment | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const [activeCall, setActiveCall] = useState<{ type: 'audio' | 'video' } | null>(null);
  const [blockedIds, setBlockedIds] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  // группа
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSelectedIds, setGroupSelectedIds] = useState<number[]>([]);
  const [groupContactSearch, setGroupContactSearch] = useState('');

  // участники
  const [showMembers, setShowMembers] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; text: string; senderName: string } | null>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Профиль из API или fallback
  const profile: UserProfile = myUser
    ? { name: myUser.name, role: myUser.role, initials: myUser.initials, avatarUrl: myUser.avatar_url, status: myUser.status }
    : DEFAULT_PROFILE;

  // Установить первый чат активным при загрузке
  useEffect(() => {
    if (activeId === 0 && chats.length > 0) {
      setActiveId(chats[0].id);
    }
  }, [chats, activeId]);

  // Загрузить сообщения при смене активного чата
  useEffect(() => {
    if (activeId && apiReady) {
      const chat = chatList.find((c) => c.id === activeId);
      if (chat && chat.messages.length === 0 && !chat.loadingMessages) {
        loadMessages(activeId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, apiReady]);

  const activeChat = chats.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeId, activeChat?.messages.length]);
  useEffect(() => { setShowMembers(false); setReplyTo(null); }, [activeId]);

  // Показываем баннер с предложением включить уведомления
  useEffect(() => {
    if (permission === 'default') {
      const t = setTimeout(() => setShowNotifBanner(true), 2000);
      return () => clearTimeout(t);
    }
  }, [permission]);

  // Симуляция входящих сообщений (только в демо-режиме без API)
  useEffect(() => {
    if (apiReady) return; // В продакшне используем реальный polling
    const initials = (name: string) => name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    const timers = INCOMING.map(({ chatId, sender, text, delay }) =>
      setTimeout(() => {
        const t = nowTime();
        setChats((prev: typeof chatList) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  last: `${sender.split(' ')[0]}: ${text}`,
                  time: t,
                  unread: c.id === activeId ? 0 : (c.unread ?? 0) + 1,
                  messages: [...c.messages, {
                    id: Date.now() + chatId, text, time: t, mine: false,
                    removed: false, edited: false, reads: 0,
                    senderName: sender, senderInitials: initials(sender), senderAvatar: null,
                  }],
                }
              : c
          )
        );
        setActiveId((cur) => {
          if (cur !== chatId) notify(sender, text, `chat-${chatId}`);
          return cur;
        });
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify, apiReady]);

  // ── отправка сообщений ───────────────────────────────────────────────────

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !activeChat) return;
    if (apiReady) {
      apiSendMessage(activeId, text, undefined, replyTo?.id);
    } else {
      const t = nowTime();
      const myName = myUser?.name ?? DEFAULT_PROFILE.name;
      const myInitials = myUser?.initials ?? DEFAULT_PROFILE.initials;
      const myAvatar = myUser?.avatar_url ?? null;
      setChats((prev: typeof chatList) =>
        prev.map((c) => c.id === activeId
          ? { ...c, last: `Вы: ${text}`, time: t, messages: [...c.messages, {
              id: Date.now(), text, time: t, mine: true,
              removed: false, edited: false, reads: 1,
              senderName: myName, senderInitials: myInitials, senderAvatar: myAvatar,
            } as typeof c.messages[0]] }
          : c)
      );
    }
    setDraft('');
    setReplyTo(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const isVideo = file.type.startsWith('video/');
      const url = URL.createObjectURL(file);
      const media = { type: isVideo ? 'video' : 'image', url, name: `${file.name} (${formatBytes(file.size)})` } as const;
      if (apiReady) {
        apiSendMessage(activeId, '', media);
      }
    });
    e.target.value = '';
  };

  const sendCircle = (url: string) => {
    if (apiReady) apiSendMessage(activeId, '', { type: 'circle', url });
  };

  // ── архив / группы / участники ───────────────────────────────────────────

  const archiveChat = (id: number) => {
    if (apiReady) apiArchive(id);
    else setChats((prev: typeof chatList) => prev.map((c) => c.id === id ? { ...c, archived: true } : c));
    if (activeId === id) { const next = chats.find((c) => c.id !== id && !c.archived); if (next) setActiveId(next.id); }
    setContextMenu(null);
  };
  const unarchiveChat = (id: number) => {
    if (apiReady) apiUnarchive(id);
    else setChats((prev: typeof chatList) => prev.map((c) => c.id === id ? { ...c, archived: false } : c));
    setContextMenu(null);
  };

  const deleteChat = (id: number) => {
    if (apiReady) apiDeleteChat(id);
    else setChats((prev: typeof chatList) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      const next = chats.find((c) => c.id !== id);
      if (next) setActiveId(next.id);
    }
    setConfirmDelete(null);
    setContextMenu(null);
  };

  const toggleBlock = (id: number) => {
    setBlockedIds((prev) => prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]);
    setContextMenu(null);
  };

  const createGroup = async () => {
    const name = groupName.trim(); if (!name) return;
    if (apiReady) {
      const res = await createChat({ is_group: true, name, description: groupDesc, member_ids: groupSelectedIds });
      if (res.ok && res.chat_id) { setActiveId(res.chat_id); setTab('chats'); }
    }
    setGroupName(''); setGroupDesc(''); setGroupSelectedIds([]); setGroupContactSearch('');
    setShowCreateGroup(false);
  };

  const addMember = (contactId: number) => {
    if (apiReady) apiAddMember(activeId, contactId);
    setAddMemberSearch('');
  };

  const removeMember = (contactId: number) => {
    if (apiReady) apiRemoveMember(activeId, contactId);
  };

  // ── производные ─────────────────────────────────────────────────────────

  const filtered = chats.filter((c) =>
    (tab === 'chats' ? !c.archived : c.archived) &&
    (c.name.toLowerCase().includes(query.toLowerCase()) || c.role.toLowerCase().includes(query.toLowerCase()))
  );
  // Контакты: реальные из API или демо-список
  const contacts = apiReady && allUsers.length > 0 ? allUsers : ALL_CONTACTS;
  const activeMembers = apiReady
    ? (activeChat?.members ?? [])
    : ALL_CONTACTS.filter((ct) => (activeChat?.memberIds ?? []).includes(ct.id));
  const nonMembers = contacts.filter(
    (ct) => !activeMembers.some((m) => m.id === ct.id) && ct.name.toLowerCase().includes(addMemberSearch.toLowerCase())
  );
  const filteredGroupContacts = contacts.filter((ct) => ct.name.toLowerCase().includes(groupContactSearch.toLowerCase()));

  // ── рендер ──────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-full flex bg-background text-foreground overflow-hidden" onClick={() => setContextMenu(null)}>

      {/* Навигация */}
      <nav className="hidden md:flex w-16 flex-col items-center justify-between py-6 bg-primary text-primary-foreground">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-md bg-primary-foreground/15 flex items-center justify-center font-bold text-sm">КМ</div>
          {[
            { icon: 'MessageSquare', active: tab === 'chats',   onClick: () => setTab('chats') },
            { icon: 'Archive',       active: tab === 'archive', onClick: () => setTab('archive') },
            { icon: 'Users',         active: false,             onClick: () => {} },
            { icon: 'Bell',          active: false,             onClick: () => {} },
            { icon: soundEnabled ? 'Volume2' : 'VolumeX', active: showSoundSettings, onClick: () => setShowSoundSettings((v) => !v) },
          ].map((item, i) => (
            <button key={i} onClick={item.onClick}
              className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${item.active ? 'bg-primary-foreground/20' : 'hover:bg-primary-foreground/10'}`}>
              <Icon name={item.icon} size={20} />
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2">
          <button onClick={() => { setSettingsTab('appearance'); setShowSettings(true); }}
            className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${showSettings ? 'bg-primary-foreground/20' : 'hover:bg-primary-foreground/10'}`}>
            <Icon name="Settings" size={20} />
          </button>
          <button onClick={() => { auth.clearToken(); navigate('/login'); }} title="Выйти"
            className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-primary-foreground/10 transition-colors opacity-70 hover:opacity-100">
            <Icon name="LogOut" size={18} />
          </button>
        </div>
      </nav>

      {/* Список чатов */}
      <aside className="w-full sm:w-80 lg:w-96 flex flex-col border-r border-border bg-card">
        <header className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                {tab === 'archive' && <Icon name="Archive" size={18} className="text-muted-foreground" />}
                {tab === 'chats' ? 'Сообщения' : 'Архив'}
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Icon name="ShieldCheck" size={12} className="text-primary" />Сквозное шифрование
              </p>
            </div>
            <div className="flex items-center gap-1">
              {tab === 'chats' && (
                <button onClick={() => setShowCreateGroup(true)} title="Создать группу"
                  className="w-9 h-9 rounded-md bg-secondary text-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors">
                  <Icon name="UsersRound" size={18} />
                </button>
              )}
              <button className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">
                <Icon name="PenSquare" size={18} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск"
              className="w-full h-10 pl-9 pr-3 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
              <Icon name="Inbox" size={32} className="opacity-30" />
              <span>{tab === 'archive' ? 'Архив пуст' : 'Нет чатов'}</span>
            </div>
          )}
          {filtered.map((chat) => (
            <button key={chat.id} onClick={() => setActiveId(chat.id)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, chatId: chat.id }); }}
              className={`w-full flex items-start gap-3 px-5 py-3.5 text-left border-b border-border/60 transition-colors ${chat.id === activeId ? 'bg-accent' : 'hover:bg-secondary/60'}`}>
              <div className="relative shrink-0">
                <div className={`w-11 h-11 rounded-md flex items-center justify-center text-sm font-semibold ${chat.group ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                  {chat.avatar}
                </div>
                {chat.online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate flex items-center gap-1.5">
                    {chat.group && <Icon name="Users" size={12} className="text-primary shrink-0" />}{chat.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{chat.time}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">{chat.last}</span>
                  {chat.unread > 0 && (
                    <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium flex items-center justify-center">{chat.unread}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Профиль */}
        <button onClick={() => setShowProfile(true)} className="px-5 py-3.5 border-t border-border flex items-center gap-3 w-full text-left hover:bg-secondary/40 transition-colors">
          <Avatar url={profile.avatarUrl} initials={profile.initials} size={9} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{profile.name}</p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />{profile.status}
            </p>
          </div>
          <Icon name="ChevronRight" size={16} className="text-muted-foreground shrink-0" />
        </button>
      </aside>

      {/* Окно переписки */}
      <main className="hidden sm:flex flex-1 flex-col min-w-0 bg-background relative"
        style={settings.wallpaper ? { backgroundImage: `url(${settings.wallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
        {activeChat ? (
          <>
            <header className="px-6 py-3.5 border-b border-border bg-card flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center text-sm font-semibold shrink-0 ${activeChat.group ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                  {activeChat.avatar}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight flex items-center gap-1.5">
                    {activeChat.group && <Icon name="Users" size={13} className="text-primary shrink-0" />}
                    {activeChat.name}
                    {activeChat.archived && <span className="ml-1 text-[10px] font-normal bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Архив</span>}
                  </p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {blockedIds.includes(activeChat.id) && <><Icon name="ShieldX" size={11} className="text-amber-500 shrink-0" /><span className="text-amber-500">Заблокирован</span></>}
                    {!blockedIds.includes(activeChat.id) && (activeChat.group ? `${activeMembers.length} участник${activeMembers.length === 1 ? '' : activeMembers.length < 5 ? 'а' : 'ов'}` : activeChat.online ? 'В сети' : activeChat.role)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => activeChat.archived ? unarchiveChat(activeChat.id) : archiveChat(activeChat.id)}
                  className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  <Icon name={activeChat.archived ? 'ArchiveRestore' : 'Archive'} size={18} />
                </button>
                {activeChat.group && (
                  <button onClick={() => setShowMembers((v) => !v)}
                    className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${showMembers ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                    <Icon name="Users" size={18} />
                  </button>
                )}
                {['Phone', 'Video', 'Search', 'MoreVertical'].map((ic) => (
                  <button key={ic}
                    onClick={() => {
                      if (ic === 'Phone') setActiveCall({ type: 'audio' });
                      if (ic === 'Video') setActiveCall({ type: 'video' });
                    }}
                    className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            </header>

            <div className="flex-1 flex min-h-0">
              {/* Сообщения */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
                  style={settings.wallpaper ? { backdropFilter: 'brightness(0.97)' } : {}}>
                  <div className="flex justify-center">
                    <span className="text-[11px] text-muted-foreground bg-secondary/90 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Icon name="Lock" size={11} />Сообщения защищены сквозным шифрованием
                    </span>
                  </div>
                  {activeChat.messages.map((m) => {
                    const replyMsg = m.replyToId ? activeChat.messages.find((r) => r.id === m.replyToId) : null;
                    const membersCount = activeChat.members?.length ?? 2;
                    const isRead = (m.reads ?? 0) >= membersCount;
                    return (
                    <div key={m.id}
                      className={`flex group animate-fade-in items-end gap-1 ${m.mine ? 'justify-end' : 'justify-start'}`}>

                      {/* Кнопка «Ответить» — слева для своих, справа для чужих */}
                      {m.mine && (
                        <button onClick={() => { setReplyTo({ id: m.id, text: m.text || (m.media ? '📎 Вложение' : ''), senderName: 'Вы' }); setTimeout(() => draftRef.current?.focus(), 50); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary shrink-0 mb-1">
                          <Icon name="Reply" size={14} />
                        </button>
                      )}

                      <div className={`max-w-[70%] ${m.media?.type === 'circle' ? '' : 'px-4 py-2.5 rounded-lg'} text-sm leading-relaxed
                        ${m.removed ? 'opacity-50 italic' : ''}
                        ${m.media?.type === 'circle' ? '' : m.mine
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-card border border-border rounded-bl-sm'}`}>

                        {/* Имя отправителя в группе */}
                        {!m.mine && activeChat.group && (
                          <p className="text-[11px] font-semibold text-primary mb-1 truncate">{m.senderName}</p>
                        )}

                        {/* Цитата */}
                        {replyMsg && (
                          <div className={`mb-2 pl-2 border-l-2 rounded-sm py-0.5 ${m.mine ? 'border-primary-foreground/40' : 'border-primary'}`}>
                            <p className={`text-[10px] font-semibold truncate ${m.mine ? 'text-primary-foreground/70' : 'text-primary'}`}>
                              {replyMsg.mine ? 'Вы' : replyMsg.senderName}
                            </p>
                            <p className={`text-[11px] truncate ${m.mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {replyMsg.text || '📎 Вложение'}
                            </p>
                          </div>
                        )}

                        {/* Медиа */}
                        {m.media?.type === 'image' && (
                          <div className="space-y-1">
                            <img src={m.media.url} alt="" className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setLightbox(m.media!)} />
                            {m.media.name && <p className={`text-[10px] ${m.mine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{m.media.name}</p>}
                          </div>
                        )}
                        {m.media?.type === 'video' && (
                          <div className="space-y-1">
                            <video src={m.media.url} controls className="max-w-xs rounded-lg" />
                            {m.media.name && <p className={`text-[10px] ${m.mine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{m.media.name}</p>}
                          </div>
                        )}
                        {m.media?.type === 'circle' && (
                          <video src={m.media.url} controls className="w-40 h-40 rounded-full object-cover border-4 border-primary cursor-pointer" onClick={() => setLightbox(m.media!)} />
                        )}

                        {/* Текст */}
                        {m.text && !m.removed && <p className={m.media ? 'mt-1' : ''}>{m.text}</p>}
                        {m.removed && <p className="text-xs">Сообщение удалено</p>}

                        {/* Время + галочки */}
                        {!m.media && (
                          <span className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${m.mine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {m.edited && <span>изм.</span>}
                            {m.time}
                            {m.mine && (
                              <span className={isRead ? 'text-sky-300' : (m.mine ? 'text-primary-foreground/60' : 'text-muted-foreground')}>
                                {isRead ? (
                                  // Двойная галочка — прочитано
                                  <svg width="16" height="10" viewBox="0 0 16 10" fill="none" className="inline">
                                    <path d="M1 5L4.5 8.5L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M5 5L8.5 8.5L15 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                ) : (
                                  // Одна галочка — доставлено
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="inline">
                                    <path d="M1 5L4 8L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* Кнопка «Ответить» для чужих */}
                      {!m.mine && (
                        <button onClick={() => { setReplyTo({ id: m.id, text: m.text || (m.media ? '📎 Вложение' : ''), senderName: m.senderName }); setTimeout(() => draftRef.current?.focus(), 50); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary shrink-0 mb-1">
                          <Icon name="Reply" size={14} />
                        </button>
                      )}
                    </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Ввод */}
                <footer className="border-t border-border bg-card shrink-0">
                  {/* Панель цитаты */}
                  {replyTo && (
                    <div className="flex items-center gap-3 px-6 pt-3 pb-1 animate-fade-in">
                      <div className="flex-1 pl-3 border-l-2 border-primary min-w-0">
                        <p className="text-[11px] font-semibold text-primary truncate">{replyTo.senderName}</p>
                        <p className="text-xs text-muted-foreground truncate">{replyTo.text}</p>
                      </div>
                      <button onClick={() => setReplyTo(null)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary shrink-0">
                        <Icon name="X" size={13} />
                      </button>
                    </div>
                  )}

                  <div className="px-6 py-4">
                  {blockedIds.includes(activeChat.id) ? (
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                      <Icon name="ShieldX" size={16} className="text-amber-500" />
                      <span>Вы заблокировали этого пользователя.</span>
                      <button onClick={() => toggleBlock(activeChat.id)} className="text-primary hover:underline underline-offset-2 text-sm">Разблокировать</button>
                    </div>
                  ) : (
                  <div className="flex items-end gap-2">
                    {/* Прикрепить файл */}
                    <button onClick={() => fileInputRef.current?.click()}
                      className="w-10 h-10 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0" title="Прикрепить фото/видео">
                      <Icon name="Paperclip" size={20} />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />

                    {/* Видео-кружок */}
                    <button onClick={() => setShowCircle(true)}
                      className="w-10 h-10 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0" title="Записать видео-кружок">
                      <Icon name="CirclePlay" size={20} />
                    </button>

                    <input ref={draftRef} value={draft} onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder={replyTo ? `Ответить ${replyTo.senderName}…` : 'Введите сообщение…'}
                      className="flex-1 h-10 px-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                    <button onClick={sendMessage}
                      className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shrink-0">
                      <Icon name="Send" size={18} />
                    </button>
                  </div>
                  )}
                  </div>
                </footer>
              </div>

              {/* Участники группы */}
              {showMembers && activeChat.group && (
                <aside className="w-72 border-l border-border bg-card flex flex-col shrink-0 animate-fade-in">
                  <div className="px-5 py-4 border-b border-border">
                    <p className="font-semibold text-sm">Участники</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activeMembers.length} чел.</p>
                  </div>
                  <div className="px-4 py-3 border-b border-border">
                    <div className="relative">
                      <Icon name="UserPlus" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input value={addMemberSearch} onChange={(e) => setAddMemberSearch(e.target.value)} placeholder="Добавить участника…"
                        className="w-full h-9 pl-9 pr-3 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                    </div>
                    {addMemberSearch && nonMembers.length > 0 && (
                      <div className="mt-2 rounded-md border border-border bg-background shadow-sm overflow-hidden">
                        {nonMembers.map((ct) => (
                          <button key={ct.id} onClick={() => addMember(ct.id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary transition-colors">
                            <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-xs font-semibold shrink-0">{ct.avatar}</div>
                            <div className="min-w-0"><p className="text-xs font-medium truncate">{ct.name}</p><p className="text-[10px] text-muted-foreground truncate">{ct.role}</p></div>
                            <Icon name="Plus" size={14} className="text-primary ml-auto shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {activeMembers.map((ct) => (
                      <div key={ct.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/60 group">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center text-xs font-semibold">{ct.avatar}</div>
                          {ct.online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />}
                        </div>
                        <div className="min-w-0 flex-1"><p className="text-xs font-medium truncate">{ct.name}</p><p className="text-[10px] text-muted-foreground truncate">{ct.role}</p></div>
                        <button onClick={() => removeMember(ct.id)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          <Icon name="UserMinus" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </aside>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
            <Icon name="MessageSquare" size={48} className="opacity-20" /><p className="text-sm">Выберите чат</p>
          </div>
        )}
      </main>

      {/* Контекстное меню */}
      {contextMenu && (
        <div className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          {(() => {
            const chat = chats.find((c) => c.id === contextMenu.chatId);
            const isBlocked = blockedIds.includes(contextMenu.chatId);
            return (
              <>
                {chat?.archived ? (
                  <button onClick={() => unarchiveChat(contextMenu.chatId)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                    <Icon name="ArchiveRestore" size={16} className="text-muted-foreground" />Вернуть из архива
                  </button>
                ) : (
                  <button onClick={() => archiveChat(contextMenu.chatId)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                    <Icon name="Archive" size={16} className="text-muted-foreground" />Отправить в архив
                  </button>
                )}
                {!chat?.group && (
                  <button onClick={() => toggleBlock(contextMenu.chatId)} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
                    <Icon name={isBlocked ? 'ShieldOff' : 'ShieldX'} size={16} className={isBlocked ? 'text-muted-foreground' : 'text-amber-500'} />
                    {isBlocked ? 'Разблокировать' : 'Заблокировать'}
                  </button>
                )}
                <div className="border-t border-border/60 my-1" />
                <button onClick={() => { setConfirmDelete(contextMenu.chatId); setContextMenu(null); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                  <Icon name="Trash2" size={16} />Удалить чат
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Создание группы */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 animate-fade-in flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
              <h2 className="font-semibold text-base">Новая группа</h2>
              <button onClick={() => { setShowCreateGroup(false); setGroupSelectedIds([]); setGroupContactSearch(''); }}
                className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="text-sm font-medium block mb-1.5">Название <span className="text-destructive">*</span></label>
                <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Название группы"
                  className="w-full h-10 px-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Описание <span className="text-muted-foreground font-normal">(необязательно)</span></label>
                <input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} placeholder="Описание"
                  className="w-full h-10 px-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Участники {groupSelectedIds.length > 0 && <span className="text-xs text-primary font-normal ml-1">{groupSelectedIds.length} выбрано</span>}</label>
                <div className="relative mb-2">
                  <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={groupContactSearch} onChange={(e) => setGroupContactSearch(e.target.value)} placeholder="Поиск контактов…"
                    className="w-full h-9 pl-9 pr-3 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                </div>
                <div className="rounded-md border border-border overflow-hidden">
                  {filteredGroupContacts.map((ct) => {
                    const sel = groupSelectedIds.includes(ct.id);
                    return (
                      <button key={ct.id} onClick={() => setGroupSelectedIds((p) => sel ? p.filter((id) => id !== ct.id) : [...p, ct.id])}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border/60 last:border-0 transition-colors ${sel ? 'bg-accent' : 'hover:bg-secondary/60'}`}>
                        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-xs font-semibold">{ct.avatar}</div>
                        <div className="min-w-0 flex-1"><p className="text-xs font-medium truncate">{ct.name}</p><p className="text-[10px] text-muted-foreground truncate">{ct.role}</p></div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-primary border-primary' : 'border-border'}`}>
                          {sel && <Icon name="Check" size={12} className="text-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
              <button onClick={() => { setShowCreateGroup(false); setGroupSelectedIds([]); setGroupContactSearch(''); }}
                className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:bg-secondary transition-colors">Отмена</button>
              <button onClick={createGroup} disabled={!groupName.trim()}
                className="h-9 px-5 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed font-medium">Создать</button>
            </div>
          </div>
        </div>
      )}

      {/* Экран звонка */}
      {activeCall && activeChat && (
        <CallScreen
          type={activeCall.type}
          name={activeChat.name}
          avatar={activeChat.avatar}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* Профиль */}
      {showProfile && (
        <ProfilePanel
          profile={profile}
          onUpdate={async (p) => {
            if (apiReady) {
              await updateProfile({ name: p.name, role: p.role, status: p.status, avatar_url: p.avatarUrl });
            }
          }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Видео-кружок */}
      {showCircle && <VideoCircleRecorder onSend={sendCircle} onClose={() => setShowCircle(false)} />}

      {/* ── Настройки приложения ── */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 animate-fade-in flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
              <h2 className="font-semibold text-base">Настройки</h2>
              <button onClick={() => setShowSettings(false)} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                <Icon name="X" size={18} />
              </button>
            </div>

            {/* Вкладки */}
            <div className="flex border-b border-border shrink-0">
              {[
                { key: 'appearance', label: 'Внешний вид', icon: 'Palette' },
                { key: 'sound',      label: 'Звук',        icon: 'Volume2'  },
              ].map((t) => (
                <button key={t.key} onClick={() => setSettingsTab(t.key as typeof settingsTab)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${settingsTab === t.key ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icon name={t.icon} size={16} />{t.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {settingsTab === 'appearance' && (
                <>
                  {/* Тема */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Тема</p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { id: 'light', label: 'Светлая', icon: 'Sun' },
                        { id: 'dark',  label: 'Тёмная',  icon: 'Moon' },
                      ] as const).map((t) => (
                        <button key={t.id} onClick={() => updateSettings({ theme: t.id })}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-colors ${settings.theme === t.id ? 'border-primary bg-accent' : 'border-border hover:bg-secondary'}`}>
                          <Icon name={t.icon} size={18} className={settings.theme === t.id ? 'text-primary' : 'text-muted-foreground'} />
                          <span className="text-sm font-medium">{t.label}</span>
                          {settings.theme === t.id && <Icon name="Check" size={15} className="text-primary ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Размер шрифта */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Размер шрифта</p>
                    <div className="grid grid-cols-4 gap-2">
                      {FONT_SIZES.map((f) => (
                        <button key={f.id} onClick={() => updateSettings({ fontSize: f.id })}
                          className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border-2 transition-colors ${settings.fontSize === f.id ? 'border-primary bg-accent' : 'border-border hover:bg-secondary'}`}>
                          <span style={{ fontSize: f.size }} className="font-semibold leading-none text-foreground">Аа</span>
                          <span className="text-[10px] text-muted-foreground">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Обои */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Обои чата</p>
                    <div className="grid grid-cols-4 gap-2">
                      {WALLPAPERS.map((w) => (
                        <button key={w.id} onClick={() => updateSettings({ wallpaper: w.url })}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${settings.wallpaper === w.url ? 'border-primary scale-95' : 'border-border hover:border-muted-foreground'}`}>
                          {w.url
                            ? <img src={w.url} alt={w.label} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-secondary flex items-center justify-center"><Icon name="Ban" size={20} className="text-muted-foreground" /></div>
                          }
                          {settings.wallpaper === w.url && (
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                              <Icon name="Check" size={18} className="text-white drop-shadow" />
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-black/40 px-1 py-0.5">
                            <p className="text-[9px] text-white text-center truncate">{w.label}</p>
                          </div>
                        </button>
                      ))}

                      {/* Загрузить своё */}
                      <button onClick={() => wallpaperInputRef.current?.click()}
                        className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors">
                        <Icon name="Upload" size={18} className="text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground text-center">Своё фото</span>
                      </button>
                      <input ref={wallpaperInputRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]; if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => updateSettings({ wallpaper: ev.target?.result as string });
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }} />
                    </div>
                  </div>
                </>
              )}

              {settingsTab === 'sound' && (
                <>
                  {/* Вкл/выкл */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Звук уведомлений</p>
                    <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-secondary">
                      <div className="flex items-center gap-2.5">
                        <Icon name={soundEnabled ? 'Volume2' : 'VolumeX'} size={18} className="text-muted-foreground" />
                        <span className="text-sm font-medium">Включить звук</span>
                      </div>
                      <button onClick={() => setSoundEnabled((v) => !v)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-primary' : 'bg-muted'}`}>
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Выбор звука */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Тип звука</p>
                    <div className="space-y-1">
                      {SOUNDS.map((s) => (
                        <button key={s.id} disabled={!soundEnabled}
                          onClick={() => { setSoundId(s.id as SoundId); playSound(s.id as SoundId); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors disabled:opacity-40 ${soundId === s.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary border border-transparent'}`}>
                          <span className="text-xl">{s.emoji}</span>
                          <span className="text-sm font-medium flex-1">{s.label}</span>
                          {soundId === s.id && <Icon name="Check" size={16} className="text-primary shrink-0" />}
                          <button onClick={(e) => { e.stopPropagation(); playSound(s.id as SoundId); }} disabled={!soundEnabled}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:pointer-events-none" title="Прослушать">
                            <Icon name="Play" size={14} />
                          </button>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border shrink-0">
              <button onClick={() => setShowSettings(false)}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Настройки звука */}
      {showSoundSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSoundSettings(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <h2 className="font-semibold text-base">Звук уведомлений</h2>
              <button onClick={() => setShowSoundSettings(false)} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                <Icon name="X" size={18} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {/* Вкл/выкл */}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <Icon name={soundEnabled ? 'Volume2' : 'VolumeX'} size={18} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Звуковые уведомления</span>
                </div>
                <button
                  onClick={() => setSoundEnabled((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Выбор звука */}
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-1">Выберите звук</p>
              <div className="space-y-1">
                {SOUNDS.map((s) => (
                  <button
                    key={s.id}
                    disabled={!soundEnabled}
                    onClick={() => {
                      setSoundId(s.id as SoundId);
                      playSound(s.id as SoundId);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors disabled:opacity-40 ${
                      soundId === s.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-secondary border border-transparent'
                    }`}
                  >
                    <span className="text-xl">{s.emoji}</span>
                    <span className="text-sm font-medium flex-1">{s.label}</span>
                    {soundId === s.id && <Icon name="Check" size={16} className="text-primary shrink-0" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); playSound(s.id as SoundId); }}
                      disabled={!soundEnabled}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:pointer-events-none"
                      title="Прослушать"
                    >
                      <Icon name="Play" size={14} />
                    </button>
                  </button>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border">
              <button
                onClick={() => setShowSoundSettings(false)}
                className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Диалог подтверждения удаления */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4 animate-fade-in">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="font-semibold text-base">Удалить чат?</h2>
              <p className="text-sm text-muted-foreground mt-1.5">
                Вся история переписки будет удалена безвозвратно. Это действие нельзя отменить.
              </p>
            </div>
            <div className="px-6 py-4 flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)}
                className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:bg-secondary transition-colors">
                Отмена
              </button>
              <button onClick={() => deleteChat(confirmDelete)}
                className="h-9 px-5 rounded-md text-sm bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity font-medium flex items-center gap-2">
                <Icon name="Trash2" size={15} />Удалить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Баннер уведомлений */}
      {showNotifBanner && permission === 'default' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-card border border-border rounded-xl shadow-xl px-5 py-4 flex items-center gap-4 max-w-sm w-full">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Icon name="Bell" size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Включить уведомления?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Получайте оповещения о новых сообщениях</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowNotifBanner(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
              >
                Позже
              </button>
              <button
                onClick={async () => {
                  await requestPermission();
                  setShowNotifBanner(false);
                }}
                className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity font-medium"
              >
                Включить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Лайтбокс */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
          {lightbox.type === 'image'
            ? <img src={lightbox.url} alt="" className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
            : <video src={lightbox.url} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          }
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <Icon name="X" size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
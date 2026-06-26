import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';

interface Message {
  id: number;
  text: string;
  time: string;
  mine: boolean;
}

interface Contact {
  id: number;
  name: string;
  role: string;
  avatar: string;
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

const ALL_CONTACTS: Contact[] = [
  { id: 1, name: 'Елена Воронцова',   role: 'Финансовый директор',         avatar: 'ЕВ', online: true  },
  { id: 2, name: 'Дмитрий Соколов',   role: 'Руководитель отдела продаж',  avatar: 'ДС', online: false },
  { id: 3, name: 'Анна Кузнецова',    role: 'HR-директор',                 avatar: 'АК', online: false },
  { id: 4, name: 'Алексей Громов',    role: 'Технический директор',        avatar: 'АГ', online: true  },
  { id: 5, name: 'Мария Лебедева',    role: 'Руководитель маркетинга',     avatar: 'МЛ', online: true  },
  { id: 6, name: 'Сергей Тихонов',    role: 'Юрист',                       avatar: 'СТ', online: false },
  { id: 7, name: 'Ольга Семёнова',    role: 'Бухгалтер',                   avatar: 'ОС', online: false },
  { id: 8, name: 'Павел Морозов',     role: 'Менеджер проекта',            avatar: 'ПМ', online: true  },
];

const INITIAL_CHATS: Chat[] = [
  {
    id: 1,
    name: 'Совет директоров',
    role: 'Группа',
    avatar: 'СД',
    last: 'Алексей: Документы согласованы, отправляю...',
    time: '14:32',
    unread: 3,
    online: true,
    group: true,
    memberIds: [1, 4, 5],
    messages: [
      { id: 1, text: 'Коллеги, добрый день. Прошу ознакомиться с обновлённым планом на Q3.', time: '14:20', mine: false },
      { id: 2, text: 'Принято. Просмотрю до конца дня и дам обратную связь.', time: '14:25', mine: true },
      { id: 3, text: 'Документы согласованы, отправляю финальную версию в почту.', time: '14:32', mine: false },
    ],
  },
  {
    id: 2,
    name: 'Елена Воронцова',
    role: 'Финансовый директор',
    avatar: 'ЕВ',
    last: 'Отчёт по бюджету готов к защите',
    time: '13:10',
    unread: 0,
    online: true,
    messages: [
      { id: 1, text: 'Иван, отчёт по бюджету готов к защите.', time: '13:08', mine: false },
      { id: 2, text: 'Отлично, спасибо. Назначим встречу на завтра.', time: '13:10', mine: true },
    ],
  },
  {
    id: 3,
    name: 'Дмитрий Соколов',
    role: 'Руководитель отдела продаж',
    avatar: 'ДС',
    last: 'Вы: Согласен, давайте обсудим на созвоне',
    time: 'Вчера',
    unread: 0,
    online: false,
    messages: [
      { id: 1, text: 'Предлагаю пересмотреть условия по ключевому клиенту.', time: '11:40', mine: false },
      { id: 2, text: 'Согласен, давайте обсудим на созвоне.', time: '11:45', mine: true },
    ],
  },
  {
    id: 4,
    name: 'Отдел маркетинга',
    role: 'Группа',
    avatar: 'ОМ',
    last: 'Мария: Кампания запущена по графику',
    time: 'Вчера',
    unread: 0,
    online: false,
    group: true,
    memberIds: [5, 2, 7],
    messages: [
      { id: 1, text: 'Кампания запущена по графику. Первые метрики завтра.', time: '18:00', mine: false },
    ],
  },
  {
    id: 5,
    name: 'Анна Кузнецова',
    role: 'HR-директор',
    avatar: 'АК',
    last: 'Кандидат подтвердил выход с понедельника',
    time: 'Пн',
    unread: 0,
    online: false,
    messages: [
      { id: 1, text: 'Кандидат подтвердил выход с понедельника.', time: '09:15', mine: false },
    ],
  },
];

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function nowTime() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default function Index() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>(INITIAL_CHATS);
  const [activeId, setActiveId] = useState<number>(1);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'chats' | 'archive'>('chats');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: number } | null>(null);

  // создание группы
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSelectedIds, setGroupSelectedIds] = useState<number[]>([]);
  const [groupContactSearch, setGroupContactSearch] = useState('');

  // панель участников группы
  const [showMembers, setShowMembers] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChat = chats.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeId, activeChat?.messages.length]);

  // закрываем панель при смене чата
  useEffect(() => { setShowMembers(false); }, [activeId]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !activeChat) return;
    const t = nowTime();
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? { ...c, last: `Вы: ${text}`, time: t, messages: [...c.messages, { id: Date.now(), text, time: t, mine: true }] }
          : c
      )
    );
    setDraft('');
  };

  const archiveChat = (id: number) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, archived: true } : c)));
    if (activeId === id) {
      const next = chats.find((c) => c.id !== id && !c.archived);
      if (next) setActiveId(next.id);
    }
    setContextMenu(null);
  };

  const unarchiveChat = (id: number) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, archived: false } : c)));
    setContextMenu(null);
  };

  const createGroup = () => {
    const name = groupName.trim();
    if (!name) return;
    const t = nowTime();
    const newChat: Chat = {
      id: Date.now(),
      name,
      role: `Группа${groupDesc ? ' · ' + groupDesc : ''}`,
      avatar: getInitials(name),
      last: 'Группа создана',
      time: t,
      unread: 0,
      online: false,
      group: true,
      memberIds: [...groupSelectedIds],
      messages: [{ id: 1, text: `Группа «${name}» создана.`, time: t, mine: true }],
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveId(newChat.id);
    setTab('chats');
    setGroupName(''); setGroupDesc(''); setGroupSelectedIds([]); setGroupContactSearch('');
    setShowCreateGroup(false);
  };

  const addMember = (contactId: number) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== activeId || !c.group) return c;
        if ((c.memberIds ?? []).includes(contactId)) return c;
        const ids = [...(c.memberIds ?? []), contactId];
        const contact = ALL_CONTACTS.find((ct) => ct.id === contactId)!;
        const t = nowTime();
        return {
          ...c,
          memberIds: ids,
          messages: [...c.messages, { id: Date.now(), text: `${contact.name} добавлен(а) в группу.`, time: t, mine: false }],
        };
      })
    );
    setAddMemberSearch('');
  };

  const removeMember = (contactId: number) => {
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== activeId || !c.group) return c;
        const ids = (c.memberIds ?? []).filter((id) => id !== contactId);
        const contact = ALL_CONTACTS.find((ct) => ct.id === contactId)!;
        const t = nowTime();
        return {
          ...c,
          memberIds: ids,
          messages: [...c.messages, { id: Date.now(), text: `${contact.name} удалён(а) из группы.`, time: t, mine: false }],
        };
      })
    );
  };

  const filtered = chats.filter(
    (c) =>
      (tab === 'chats' ? !c.archived : c.archived) &&
      (c.name.toLowerCase().includes(query.toLowerCase()) || c.role.toLowerCase().includes(query.toLowerCase()))
  );

  const activeMemberIds = activeChat?.memberIds ?? [];
  const activeMembers = ALL_CONTACTS.filter((ct) => activeMemberIds.includes(ct.id));
  const nonMembers = ALL_CONTACTS.filter(
    (ct) => !activeMemberIds.includes(ct.id) && ct.name.toLowerCase().includes(addMemberSearch.toLowerCase())
  );
  const filteredGroupContacts = ALL_CONTACTS.filter(
    (ct) => ct.name.toLowerCase().includes(groupContactSearch.toLowerCase())
  );

  return (
    <div className="h-screen w-full flex bg-background text-foreground overflow-hidden" onClick={() => setContextMenu(null)}>

      {/* Узкая навигация */}
      <nav className="hidden md:flex w-16 flex-col items-center justify-between py-6 bg-primary text-primary-foreground">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-md bg-primary-foreground/15 flex items-center justify-center font-bold tracking-tight text-sm">КМ</div>
          {[
            { icon: 'MessageSquare', active: tab === 'chats',   onClick: () => setTab('chats') },
            { icon: 'Archive',       active: tab === 'archive', onClick: () => setTab('archive') },
            { icon: 'Users',         active: false,             onClick: () => {} },
            { icon: 'Bell',          active: false,             onClick: () => {} },
          ].map((item, i) => (
            <button key={i} onClick={item.onClick}
              className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${item.active ? 'bg-primary-foreground/20' : 'hover:bg-primary-foreground/10'}`}>
              <Icon name={item.icon} size={20} />
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-2">
          <button className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-primary-foreground/10 transition-colors">
            <Icon name="Settings" size={20} />
          </button>
          <button
            onClick={() => navigate('/login')}
            title="Выйти"
            className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-primary-foreground/10 transition-colors opacity-70 hover:opacity-100"
          >
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
                <Icon name="ShieldCheck" size={12} className="text-primary" />
                Сквозное шифрование
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
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по чатам и контактам"
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
                    {chat.group && <Icon name="Users" size={12} className="text-primary shrink-0" />}
                    {chat.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">{chat.time}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground truncate">{chat.last}</span>
                  {chat.unread > 0 && (
                    <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-medium flex items-center justify-center">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">ИП</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">Иван Петров</p>
            <p className="text-xs text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> В сети</p>
          </div>
          <button className="text-muted-foreground hover:text-foreground transition-colors"><Icon name="Settings" size={18} /></button>
        </div>
      </aside>

      {/* Окно переписки */}
      <main className="hidden sm:flex flex-1 flex-col bg-background min-w-0">
        {activeChat ? (
          <>
            <header className="px-6 py-3.5 border-b border-border bg-card flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center text-sm font-semibold shrink-0 ${activeChat.group ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                  {activeChat.avatar}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight flex items-center gap-1.5 truncate">
                    {activeChat.group && <Icon name="Users" size={13} className="text-primary shrink-0" />}
                    {activeChat.name}
                    {activeChat.archived && (
                      <span className="ml-1 text-[10px] font-normal bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Архив</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activeChat.group
                      ? `${activeMembers.length} участник${activeMembers.length === 1 ? '' : activeMembers.length < 5 ? 'а' : 'ов'}`
                      : activeChat.online ? 'В сети' : activeChat.role}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => activeChat.archived ? unarchiveChat(activeChat.id) : archiveChat(activeChat.id)}
                  title={activeChat.archived ? 'Вернуть из архива' : 'В архив'}
                  className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                  <Icon name={activeChat.archived ? 'ArchiveRestore' : 'Archive'} size={18} />
                </button>
                {activeChat.group && (
                  <button onClick={() => setShowMembers((v) => !v)} title="Участники"
                    className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${showMembers ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                    <Icon name="Users" size={18} />
                  </button>
                )}
                {['Phone', 'Video', 'Search', 'MoreVertical'].map((ic) => (
                  <button key={ic} className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                    <Icon name={ic} size={18} />
                  </button>
                ))}
              </div>
            </header>

            <div className="flex-1 flex min-h-0">
              {/* Сообщения */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                  <div className="flex justify-center">
                    <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Icon name="Lock" size={11} />
                      Сообщения защищены сквозным шифрованием
                    </span>
                  </div>
                  {activeChat.messages.map((m) => (
                    <div key={m.id} className={`flex animate-fade-in ${m.mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2.5 rounded-lg text-sm leading-relaxed ${m.mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-card border border-border rounded-bl-sm'}`}>
                        <p>{m.text}</p>
                        <span className={`block text-[10px] mt-1 text-right ${m.mine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{m.time}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <footer className="px-6 py-4 border-t border-border bg-card shrink-0">
                  <div className="flex items-end gap-2">
                    <button className="w-10 h-10 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0">
                      <Icon name="Paperclip" size={20} />
                    </button>
                    <input value={draft} onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="Введите сообщение…"
                      className="flex-1 h-10 px-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                    <button onClick={sendMessage}
                      className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shrink-0">
                      <Icon name="Send" size={18} />
                    </button>
                  </div>
                </footer>
              </div>

              {/* Панель участников */}
              {showMembers && activeChat.group && (
                <aside className="w-72 border-l border-border bg-card flex flex-col shrink-0 animate-fade-in">
                  <div className="px-5 py-4 border-b border-border">
                    <p className="font-semibold text-sm">Участники группы</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activeMembers.length} чел.</p>
                  </div>

                  {/* Поиск для добавления */}
                  <div className="px-4 py-3 border-b border-border">
                    <div className="relative">
                      <Icon name="UserPlus" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input value={addMemberSearch} onChange={(e) => setAddMemberSearch(e.target.value)}
                        placeholder="Добавить участника…"
                        className="w-full h-9 pl-9 pr-3 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                    </div>
                    {addMemberSearch && nonMembers.length > 0 && (
                      <div className="mt-2 rounded-md border border-border bg-background shadow-sm overflow-hidden">
                        {nonMembers.map((ct) => (
                          <button key={ct.id} onClick={() => addMember(ct.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-secondary transition-colors">
                            <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-xs font-semibold shrink-0">{ct.avatar}</div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{ct.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{ct.role}</p>
                            </div>
                            <Icon name="Plus" size={14} className="text-primary ml-auto shrink-0" />
                          </button>
                        ))}
                        {nonMembers.length === 0 && addMemberSearch && (
                          <p className="text-xs text-muted-foreground px-3 py-2">Не найдено</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Список участников */}
                  <div className="flex-1 overflow-y-auto">
                    {activeMembers.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-xs gap-2">
                        <Icon name="Users" size={28} className="opacity-20" />
                        <span>Нет участников</span>
                      </div>
                    )}
                    {activeMembers.map((ct) => (
                      <div key={ct.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/60 group">
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center text-xs font-semibold">{ct.avatar}</div>
                          {ct.online && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{ct.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{ct.role}</p>
                        </div>
                        <button onClick={() => removeMember(ct.id)} title="Удалить из группы"
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
            <Icon name="MessageSquare" size={48} className="opacity-20" />
            <p className="text-sm">Выберите чат</p>
          </div>
        )}
      </main>

      {/* Контекстное меню */}
      {contextMenu && (
        <div className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px] animate-fade-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}>
          {chats.find((c) => c.id === contextMenu.chatId)?.archived ? (
            <button onClick={() => unarchiveChat(contextMenu.chatId)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
              <Icon name="ArchiveRestore" size={16} className="text-muted-foreground" />
              Вернуть из архива
            </button>
          ) : (
            <button onClick={() => archiveChat(contextMenu.chatId)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-secondary transition-colors">
              <Icon name="Archive" size={16} className="text-muted-foreground" />
              Отправить в архив
            </button>
          )}
          <button onClick={() => setContextMenu(null)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-secondary transition-colors">
            <Icon name="Trash2" size={16} />
            Удалить чат
          </button>
        </div>
      )}

      {/* Модальное окно — создать группу */}
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
                <label className="text-sm font-medium block mb-1.5">Название группы <span className="text-destructive">*</span></label>
                <input autoFocus value={groupName} onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Например: Проектная команда"
                  className="w-full h-10 px-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Описание <span className="text-muted-foreground font-normal">(необязательно)</span></label>
                <input value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)}
                  placeholder="Например: Разработка продукта"
                  className="w-full h-10 px-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
              </div>

              {/* Выбор участников */}
              <div>
                <label className="text-sm font-medium block mb-1.5">
                  Участники
                  {groupSelectedIds.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-primary">{groupSelectedIds.length} выбрано</span>
                  )}
                </label>
                <div className="relative mb-2">
                  <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input value={groupContactSearch} onChange={(e) => setGroupContactSearch(e.target.value)}
                    placeholder="Поиск контактов…"
                    className="w-full h-9 pl-9 pr-3 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                </div>
                <div className="rounded-md border border-border overflow-hidden">
                  {filteredGroupContacts.map((ct) => {
                    const selected = groupSelectedIds.includes(ct.id);
                    return (
                      <button key={ct.id}
                        onClick={() => setGroupSelectedIds((prev) => selected ? prev.filter((id) => id !== ct.id) : [...prev, ct.id])}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-border/60 last:border-0 transition-colors ${selected ? 'bg-accent' : 'hover:bg-secondary/60'}`}>
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-xs font-semibold">{ct.avatar}</div>
                          {ct.online && <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-card" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{ct.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{ct.role}</p>
                        </div>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-primary border-primary' : 'border-border'}`}>
                          {selected && <Icon name="Check" size={12} className="text-primary-foreground" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-2 shrink-0">
              <button onClick={() => { setShowCreateGroup(false); setGroupSelectedIds([]); setGroupContactSearch(''); }}
                className="h-9 px-4 rounded-md text-sm text-muted-foreground hover:bg-secondary transition-colors">
                Отмена
              </button>
              <button onClick={createGroup} disabled={!groupName.trim()}
                className="h-9 px-5 rounded-md text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                Создать группу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
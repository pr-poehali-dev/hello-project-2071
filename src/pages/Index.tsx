import { useState } from 'react';
import Icon from '@/components/ui/icon';

interface Message {
  id: number;
  text: string;
  time: string;
  mine: boolean;
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
  members?: number;
  messages: Message[];
}

const CHATS: Chat[] = [
  {
    id: 1,
    name: 'Совет директоров',
    role: 'Группа · 8 участников',
    avatar: 'СД',
    last: 'Алексей: Документы согласованы, отправляю...',
    time: '14:32',
    unread: 3,
    online: true,
    group: true,
    members: 8,
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
    role: 'Группа · 12 участников',
    avatar: 'ОМ',
    last: 'Мария: Кампания запущена по графику',
    time: 'Вчера',
    unread: 0,
    online: false,
    group: true,
    members: 12,
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

const Index = () => {
  const [chats, setChats] = useState<Chat[]>(CHATS);
  const [activeId, setActiveId] = useState(1);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const active = chats.find((c) => c.id === activeId)!;

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              last: `Вы: ${text}`,
              time,
              messages: [
                ...c.messages,
                { id: Date.now(), text, time, mine: true },
              ],
            }
          : c
      )
    );
    setDraft('');
  };

  const filtered = chats.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.role.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="h-screen w-full flex bg-background text-foreground overflow-hidden">
      {/* Узкая навигация */}
      <nav className="hidden md:flex w-16 flex-col items-center justify-between py-6 bg-primary text-primary-foreground">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-md bg-primary-foreground/15 flex items-center justify-center font-bold tracking-tight">
            КМ
          </div>
          {[
            { icon: 'MessageSquare', active: true },
            { icon: 'Users', active: false },
            { icon: 'Phone', active: false },
            { icon: 'Bell', active: false },
          ].map((item, i) => (
            <button
              key={i}
              className={`w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
                item.active ? 'bg-primary-foreground/20' : 'hover:bg-primary-foreground/10'
              }`}
            >
              <Icon name={item.icon} size={20} />
            </button>
          ))}
        </div>
        <button className="w-10 h-10 rounded-md flex items-center justify-center hover:bg-primary-foreground/10 transition-colors">
          <Icon name="Settings" size={20} />
        </button>
      </nav>

      {/* Список чатов */}
      <aside className="w-full sm:w-80 lg:w-96 flex flex-col border-r border-border bg-card">
        <header className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Сообщения</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Icon name="ShieldCheck" size={12} className="text-primary" />
                Сквозное шифрование
              </p>
            </div>
            <button className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">
              <Icon name="PenSquare" size={18} />
            </button>
          </div>
          <div className="relative">
            <Icon
              name="Search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по чатам и контактам"
              className="w-full h-10 pl-9 pr-3 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveId(chat.id)}
              className={`w-full flex items-start gap-3 px-5 py-3.5 text-left border-b border-border/60 transition-colors ${
                chat.id === activeId ? 'bg-accent' : 'hover:bg-secondary/60'
              }`}
            >
              <div className="relative shrink-0">
                <div
                  className={`w-11 h-11 rounded-md flex items-center justify-center text-sm font-semibold ${
                    chat.group
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {chat.avatar}
                </div>
                {chat.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{chat.name}</span>
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

        {/* Профиль */}
        <div className="px-5 py-3.5 border-t border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
            ИП
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">Иван Петров</p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> В сети
            </p>
          </div>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="Settings" size={18} />
          </button>
        </div>
      </aside>

      {/* Окно переписки */}
      <main className="hidden sm:flex flex-1 flex-col bg-background">
        <header className="px-6 py-3.5 border-b border-border bg-card flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-md flex items-center justify-center text-sm font-semibold ${
                active.group ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {active.avatar}
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{active.name}</p>
              <p className="text-xs text-muted-foreground">
                {active.online ? 'В сети' : active.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {['Phone', 'Video', 'Search', 'MoreVertical'].map((ic) => (
              <button
                key={ic}
                className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Icon name={ic} size={18} />
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          <div className="flex justify-center">
            <span className="text-[11px] text-muted-foreground bg-secondary px-3 py-1 rounded-full flex items-center gap-1.5">
              <Icon name="Lock" size={11} />
              Сообщения защищены сквозным шифрованием
            </span>
          </div>
          {active.messages.map((m) => (
            <div
              key={m.id}
              className={`flex animate-message-in ${m.mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2.5 rounded-lg text-sm leading-relaxed ${
                  m.mine
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-card border border-border rounded-bl-sm'
                }`}
              >
                <p>{m.text}</p>
                <span
                  className={`block text-[10px] mt-1 text-right ${
                    m.mine ? 'text-primary-foreground/60' : 'text-muted-foreground'
                  }`}
                >
                  {m.time}
                </span>
              </div>
            </div>
          ))}
        </div>

        <footer className="px-6 py-4 border-t border-border bg-card">
          <div className="flex items-end gap-2">
            <button className="w-10 h-10 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors shrink-0">
              <Icon name="Paperclip" size={20} />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Введите сообщение…"
              className="flex-1 h-10 px-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
            <button
              onClick={sendMessage}
              className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
            >
              <Icon name="Send" size={18} />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
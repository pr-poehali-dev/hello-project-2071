import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Icon from '@/components/ui/icon';

interface SavedAccount {
  id: string;
  name: string;
  role: string;
  initials: string;
  avatarUrl: string | null;
}

const DEMO_USERS = [
  { login: 'ivanov',     password: '1234', name: 'Иван Петров',     role: 'Генеральный директор',  initials: 'ИП' },
  { login: 'vorontsova', password: '1234', name: 'Елена Воронцова', role: 'Финансовый директор',   initials: 'ЕВ' },
  { login: 'sokolov',    password: '1234', name: 'Дмитрий Соколов', role: 'Рук. отдела продаж',    initials: 'ДС' },
];

const QR_SESSION = `${typeof window !== 'undefined' ? window.location.origin : ''}?qr=1&s=${Math.random().toString(36).slice(2, 10)}`;

function Avatar({ url, initials, size = 12 }: { url: string | null; initials: string; size?: number }) {
  const sz = `w-${size} h-${size}`;
  if (url) return <img src={url} alt={initials} className={`${sz} rounded-xl object-cover`} />;
  return <div className={`${sz} rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg`}>{initials}</div>;
}

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'accounts' | 'login' | 'register'>('accounts');
  const [loginTab, setLoginTab] = useState<'password' | 'qr'>('password');

  // Сохранённые аккаунты
  const [accounts, setAccounts] = useState<SavedAccount[]>([
    { id: '1', name: 'Иван Петров', role: 'Генеральный директор', initials: 'ИП', avatarUrl: null },
  ]);

  // Форма входа
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  // Форма регистрации нового аккаунта
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('');
  const [regLogin, setRegLogin] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regAvatar, setRegAvatar] = useState<string | null>(null);
  const [regError, setRegError] = useState('');

  // QR
  const [qrScanned, setQrScanned] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(60);

  useEffect(() => {
    if (loginTab !== 'qr') return;
    setQrScanned(false); setQrCountdown(60);
    const iv = setInterval(() => setQrCountdown((v) => v > 1 ? v - 1 : 0), 1000);
    const t = setTimeout(() => { setQrScanned(true); setTimeout(() => navigate('/'), 1500); }, 8000);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [loginTab, navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const user = DEMO_USERS.find((u) => u.login === login && u.password === password);
    if (!user) { setError('Неверный логин или пароль'); return; }
    // добавляем в список если ещё нет
    setAccounts((prev) => {
      if (prev.find((a) => a.name === user.name)) return prev;
      return [...prev, { id: Date.now().toString(), name: user.name, role: user.role, initials: user.initials, avatarUrl: null }];
    });
    navigate('/');
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault(); setRegError('');
    if (!regName.trim()) { setRegError('Введите имя'); return; }
    if (!regLogin.trim()) { setRegError('Введите логин'); return; }
    if (regPass.length < 4) { setRegError('Пароль — минимум 4 символа'); return; }
    const initials = regName.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    setAccounts((prev) => [...prev, { id: Date.now().toString(), name: regName.trim(), role: regRole.trim() || 'Сотрудник', initials, avatarUrl: regAvatar }]);
    setMode('accounts');
    setRegName(''); setRegRole(''); setRegLogin(''); setRegPass(''); setRegAvatar(null);
  };

  const handleAvatarReg = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRegAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-4">КМ</div>
          <h1 className="text-2xl font-semibold tracking-tight">КорпМессенджер</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <Icon name="ShieldCheck" size={13} className="text-primary" />Защищённый корпоративный мессенджер
          </p>
        </div>

        {/* ── Список аккаунтов ── */}
        {mode === 'accounts' && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <div className="px-6 py-5 border-b border-border">
              <h2 className="font-semibold text-base">Выберите аккаунт</h2>
            </div>
            <div>
              {accounts.map((acc) => (
                <button key={acc.id} onClick={() => navigate('/')}
                  className="w-full flex items-center gap-4 px-6 py-4 border-b border-border/60 hover:bg-secondary/50 transition-colors text-left">
                  <Avatar url={acc.avatarUrl} initials={acc.initials} size={12} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{acc.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{acc.role}</p>
                  </div>
                  <Icon name="ChevronRight" size={18} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
            <div className="px-6 py-4 flex flex-col gap-2">
              <button onClick={() => setMode('login')}
                className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <Icon name="LogIn" size={16} />Войти в другой аккаунт
              </button>
              <button onClick={() => setMode('register')}
                className="w-full h-11 rounded-md bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2">
                <Icon name="UserPlus" size={16} />Добавить аккаунт
              </button>
            </div>
          </div>
        )}

        {/* ── Вход ── */}
        {mode === 'login' && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <div className="flex border-b border-border">
              <button onClick={() => setMode('accounts')} className="w-10 h-14 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="ArrowLeft" size={18} />
              </button>
              {[{ key: 'password', label: 'Логин и пароль', icon: 'KeyRound' }, { key: 'qr', label: 'QR-код', icon: 'QrCode' }].map((t) => (
                <button key={t.key} onClick={() => setLoginTab(t.key as 'password' | 'qr')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${loginTab === t.key ? 'text-primary border-b-2 border-primary bg-accent/50' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'}`}>
                  <Icon name={t.icon} size={16} />{t.label}
                </button>
              ))}
            </div>

            {loginTab === 'password' && (
              <form onSubmit={handleLogin} className="px-6 py-6 space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Логин</label>
                  <div className="relative">
                    <Icon name="User" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="ivanov" autoComplete="username"
                      className="w-full h-11 pl-9 pr-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Пароль</label>
                  <div className="relative">
                    <Icon name="Lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                      className="w-full h-11 pl-9 pr-10 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                    <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name={showPass ? 'EyeOff' : 'Eye'} size={16} />
                    </button>
                  </div>
                </div>
                {error && <p className="text-xs text-destructive flex items-center gap-1.5 animate-fade-in"><Icon name="AlertCircle" size={13} />{error}</p>}
                <button type="submit" className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">Войти</button>
                <p className="text-center text-xs text-muted-foreground">
                  Демо: <span className="font-mono text-foreground">ivanov</span> / <span className="font-mono text-foreground">1234</span>
                </p>
              </form>
            )}

            {loginTab === 'qr' && (
              <div className="px-6 py-6 flex flex-col items-center text-center">
                {!qrScanned ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-5">Откройте мессенджер на телефоне и отсканируйте код</p>
                    <div className="relative p-3 bg-white rounded-xl border border-border shadow-sm mb-4">
                      <QRCodeSVG value={QR_SESSION} size={180} bgColor="#ffffff" fgColor="#1e3a5f" level="M" marginSize={1} />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow">КМ</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon name="Clock" size={13} />Код действует <span className="font-mono text-foreground font-medium ml-1">{qrCountdown}с</span>
                    </div>
                    {qrCountdown === 0 && (
                      <button onClick={() => setLoginTab('qr')} className="mt-3 text-xs text-primary underline underline-offset-2">Обновить QR-код</button>
                    )}
                  </>
                ) : (
                  <div className="py-6 flex flex-col items-center gap-3 animate-fade-in">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                      <Icon name="CheckCircle2" size={36} className="text-green-600" />
                    </div>
                    <p className="font-semibold text-base">QR-код отсканирован</p>
                    <p className="text-sm text-muted-foreground">Выполняется вход…</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Регистрация нового аккаунта ── */}
        {mode === 'register' && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
              <button onClick={() => setMode('accounts')} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                <Icon name="ArrowLeft" size={18} />
              </button>
              <h2 className="font-semibold text-base">Добавить аккаунт</h2>
            </div>
            <form onSubmit={handleRegister} className="px-6 py-6 space-y-4">
              {/* Аватар */}
              <div className="flex items-center gap-4">
                <label className="relative cursor-pointer">
                  {regAvatar
                    ? <img src={regAvatar} alt="avatar" className="w-16 h-16 rounded-xl object-cover" />
                    : <div className="w-16 h-16 rounded-xl bg-secondary border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary transition-colors"><Icon name="Camera" size={24} /></div>
                  }
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarReg} />
                </label>
                <div>
                  <p className="text-sm font-medium">{regName || 'Ваше имя'}</p>
                  <p className="text-xs text-muted-foreground">{regRole || 'Должность'}</p>
                  <p className="text-xs text-primary mt-1">Нажмите для фото</p>
                </div>
              </div>

              {[
                { label: 'Имя и фамилия *', val: regName, set: setRegName, placeholder: 'Иван Петров' },
                { label: 'Должность',       val: regRole, set: setRegRole, placeholder: 'Менеджер' },
                { label: 'Логин *',         val: regLogin, set: setRegLogin, placeholder: 'ivanov' },
                { label: 'Пароль *',        val: regPass, set: setRegPass, placeholder: '••••••••', type: 'password' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-sm font-medium block mb-1.5">{f.label}</label>
                  <input type={f.type ?? 'text'} value={f.val} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder}
                    className="w-full h-10 px-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                </div>
              ))}

              {regError && <p className="text-xs text-destructive flex items-center gap-1.5"><Icon name="AlertCircle" size={13} />{regError}</p>}

              <button type="submit" className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity">
                Создать аккаунт
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">Все данные защищены сквозным шифрованием</p>
      </div>
    </div>
  );
}

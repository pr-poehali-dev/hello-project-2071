import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Icon from '@/components/ui/icon';

const DEMO_USERS = [
  { login: 'ivanov', password: '1234', name: 'Иван Петров', role: 'Генеральный директор', avatar: 'ИП' },
  { login: 'vorontsova', password: '1234', name: 'Елена Воронцова', role: 'Финансовый директор', avatar: 'ЕВ' },
];

const QR_URL = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
const QR_SESSION = `${QR_URL}?qr=1&session=${Math.random().toString(36).slice(2, 10)}`;

export default function Login() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'password' | 'qr'>('password');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [qrScanned, setQrScanned] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(60);

  // Симуляция "сканирования" QR
  useEffect(() => {
    if (tab !== 'qr') return;
    setQrScanned(false);
    setQrCountdown(60);
    const interval = setInterval(() => {
      setQrCountdown((v) => {
        if (v <= 1) { clearInterval(interval); return 0; }
        return v - 1;
      });
    }, 1000);
    // Симулируем успешное сканирование через 8 сек (для демо)
    const scanTimer = setTimeout(() => {
      setQrScanned(true);
      setTimeout(() => navigate('/'), 1500);
    }, 8000);
    return () => { clearInterval(interval); clearTimeout(scanTimer); };
  }, [tab, navigate]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const user = DEMO_USERS.find((u) => u.login === login && u.password === password);
    if (!user) { setError('Неверный логин или пароль'); return; }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Фон */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Логотип */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-4">
            КМ
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">КорпМессенджер</h1>
          <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <Icon name="ShieldCheck" size={13} className="text-primary" />
            Защищённый корпоративный мессенджер
          </p>
        </div>

        {/* Карточка */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {/* Табы */}
          <div className="flex border-b border-border">
            {[
              { key: 'password', label: 'Логин и пароль', icon: 'KeyRound' },
              { key: 'qr',       label: 'QR-код',         icon: 'QrCode'   },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as 'password' | 'qr')}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? 'text-primary border-b-2 border-primary bg-accent/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                }`}
              >
                <Icon name={t.icon} size={16} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Вход по паролю */}
          {tab === 'password' && (
            <form onSubmit={handleLogin} className="px-6 py-6 space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Логин</label>
                <div className="relative">
                  <Icon name="User" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="ivanov"
                    autoComplete="username"
                    className="w-full h-11 pl-9 pr-4 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Пароль</label>
                <div className="relative">
                  <Icon name="Lock" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full h-11 pl-9 pr-10 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Icon name={showPass ? 'EyeOff' : 'Eye'} size={16} />
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-xs text-destructive flex items-center gap-1.5 animate-fade-in">
                  <Icon name="AlertCircle" size={13} />
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
              >
                Войти
              </button>

              <p className="text-center text-xs text-muted-foreground pt-1">
                Демо: логин <span className="font-mono text-foreground">ivanov</span>, пароль <span className="font-mono text-foreground">1234</span>
              </p>
            </form>
          )}

          {/* Вход по QR */}
          {tab === 'qr' && (
            <div className="px-6 py-6 flex flex-col items-center text-center">
              {!qrScanned ? (
                <>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    Откройте мессенджер на телефоне и отсканируйте код для мгновенного входа
                  </p>
                  <div className="relative p-3 bg-white rounded-xl border border-border shadow-sm mb-4">
                    <QRCodeSVG
                      value={QR_SESSION}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#1e3a5f"
                      level="M"
                      marginSize={1}
                    />
                    {/* Логотип в центре QR */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow">
                        КМ
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon name="Clock" size={13} />
                    Код действует <span className="font-mono text-foreground font-medium">{qrCountdown}с</span>
                  </div>
                  {qrCountdown === 0 && (
                    <button
                      onClick={() => setTab('qr')}
                      className="mt-3 text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                    >
                      Обновить QR-код
                    </button>
                  )}
                  <div className="mt-5 bg-secondary rounded-lg px-4 py-3 text-left w-full space-y-2">
                    {[
                      'Откройте приложение на телефоне',
                      'Перейдите в Профиль → Войти на другом устройстве',
                      'Наведите камеру на QR-код',
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <span className="w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
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

        <p className="text-center text-xs text-muted-foreground mt-6">
          Все данные защищены сквозным шифрованием
        </p>
      </div>
    </div>
  );
}

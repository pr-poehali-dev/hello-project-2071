import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import Icon from '@/components/ui/icon';
import { auth } from '@/lib/api';

interface SavedAccount {
  id: string;
  name: string;
  role: string;
  initials: string;
  avatarUrl: string | null;
  phone: string;
}

type Mode = 'accounts' | 'phone' | 'code' | 'register' | 'qr';

const DEMO_PHONES: Record<string, { name: string; role: string; initials: string }> = {
  '+7 900 000 0001': { name: 'Иван Петров',     role: 'Генеральный директор', initials: 'ИП' },
  '+7 900 000 0002': { name: 'Елена Воронцова', role: 'Финансовый директор',  initials: 'ЕВ' },
  '+7 900 000 0003': { name: 'Дмитрий Соколов', role: 'Рук. отдела продаж',   initials: 'ДС' },
};

const QR_SESSION = `${typeof window !== 'undefined' ? window.location.origin : ''}?qr=1&s=${Math.random().toString(36).slice(2, 10)}`;
const RESEND_TIMEOUT = 60;
const SMS_URL = 'https://functions.poehali.dev/3353b357-5daf-4c33-a0da-54a127b3f6e5';

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  let out = '+';
  if (digits[0] === '7' || digits[0] === '8') {
    out += '7';
    if (digits.length > 1) out += ' ' + digits.slice(1, 4);
    if (digits.length > 4) out += ' ' + digits.slice(4, 7);
    if (digits.length > 7) out += ' ' + digits.slice(7, 9);
    if (digits.length > 9) out += ' ' + digits.slice(9, 11);
  } else {
    out += digits;
  }
  return out;
}

function Avatar({ url, initials, size = 12 }: { url: string | null; initials: string; size?: number }) {
  const sz = `w-${size} h-${size}`;
  if (url) return <img src={url} alt={initials} className={`${sz} rounded-xl object-cover`} />;
  return <div className={`${sz} rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg`}>{initials}</div>;
}

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('accounts');

  // Сохранённые аккаунты
  const [accounts, setAccounts] = useState<SavedAccount[]>(() => {
    try {
      const s = localStorage.getItem('km-accounts');
      if (s) return JSON.parse(s) as SavedAccount[];
    } catch { /* ignore */ }
    return [{ id: '1', name: 'Иван Петров', role: 'Генеральный директор', initials: 'ИП', avatarUrl: null, phone: '+7 900 000 0001' }];
  });

  // Вход по телефону
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeDigits, setCodeDigits] = useState(['', '', '', '']);
  const [codeError, setCodeError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [smsSending, setSmsSending] = useState(false);
  const [smsDemo, setSmsDemo] = useState(false);
  const codeRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  // Регистрация
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAvatar, setRegAvatar] = useState<string | null>(null);
  const [regError, setRegError] = useState('');

  // QR
  const [qrScanned, setQrScanned] = useState(false);
  const [qrCountdown, setQrCountdown] = useState(60);

  // Сохраняем аккаунты
  useEffect(() => {
    try { localStorage.setItem('km-accounts', JSON.stringify(accounts)); } catch { /* ignore */ }
  }, [accounts]);

  // Таймер повторной отправки
  useEffect(() => {
    if (resendTimer <= 0) return;
    const iv = setInterval(() => setResendTimer((v) => v - 1), 1000);
    return () => clearInterval(iv);
  }, [resendTimer]);

  // QR
  useEffect(() => {
    if (mode !== 'qr') return;
    setQrScanned(false); setQrCountdown(60);
    const iv = setInterval(() => setQrCountdown((v) => v > 1 ? v - 1 : 0), 1000);
    const t = setTimeout(() => { setQrScanned(true); setTimeout(() => navigate('/'), 1500); }, 8000);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [mode, navigate]);

  const sendCode = async () => {
    setPhoneError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 11) { setPhoneError('Введите корректный номер телефона'); return; }
    setSmsSending(true);
    setSmsDemo(false);
    try {
      const data = await auth.sendCode(phone);
      if (data.demo) {
        setSmsDemo(true);
        if (data.code) setGeneratedCode(data.code);
      } else {
        setGeneratedCode('');
      }
    } catch {
      setSmsDemo(true);
    } finally {
      setSmsSending(false);
    }
    setCodeDigits(['', '', '', '']);
    setCodeError('');
    setResendTimer(RESEND_TIMEOUT);
    setMode('code');
    setTimeout(() => codeRefs[0].current?.focus(), 100);
  };

  const handleCodeInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...codeDigits];
    next[idx] = digit;
    setCodeDigits(next);
    setCodeError('');
    if (digit && idx < 3) codeRefs[idx + 1].current?.focus();
    // Автопроверка при вводе 4-й цифры
    if (idx === 3 && digit) verifyCode([...next.slice(0, 3), digit]);
  };

  const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !codeDigits[idx] && idx > 0) {
      codeRefs[idx - 1].current?.focus();
    }
  };

  const [verifying, setVerifying] = useState(false);
  const [needName, setNeedName] = useState(false);
  const [regNameInline, setRegNameInline] = useState('');
  const [regRoleInline, setRegRoleInline] = useState('');

  const verifyCode = async (digits = codeDigits) => {
    const entered = digits.join('');
    if (entered.length < 4) { setCodeError('Введите все 4 цифры'); return; }
    setVerifying(true);
    setCodeError('');
    try {
      const res = await auth.verify(phone, entered, regNameInline || undefined, regRoleInline || undefined);
      if (res.need_name) {
        setNeedName(true);
        setVerifying(false);
        return;
      }
      if (!res.ok) {
        setCodeError('Неверный или устаревший код');
        setCodeDigits(['', '', '', '']);
        setTimeout(() => codeRefs[0].current?.focus(), 50);
        setVerifying(false);
        return;
      }
      if (res.token) auth.setToken(res.token);
      const u = res.user;
      if (u) {
        const fmt = formatPhone(phone);
        setAccounts((prev) => {
          if (prev.find((a) => a.phone === fmt)) return prev;
          return [...prev, { id: String(u.id), name: u.name, role: u.role, initials: u.initials, avatarUrl: u.avatar_url, phone: fmt }];
        });
      }
      navigate('/');
    } catch {
      setCodeError('Ошибка соединения. Попробуйте ещё раз');
    } finally {
      setVerifying(false);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault(); setRegError('');
    if (!regName.trim()) { setRegError('Введите имя'); return; }
    const fmt = formatPhone(regPhone);
    if (fmt.replace(/\D/g, '').length < 11) { setRegError('Введите номер телефона'); return; }
    const initials = regName.trim().split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    setAccounts((prev) => [...prev, { id: Date.now().toString(), name: regName.trim(), role: regRole.trim() || 'Сотрудник', initials, avatarUrl: regAvatar, phone: fmt }]);
    setMode('accounts');
    setRegName(''); setRegRole(''); setRegPhone(''); setRegAvatar(null);
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
                  <Avatar url={acc.avatarUrl} initials={acc.initials} size={11} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{acc.name}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Icon name="Phone" size={11} />{acc.phone}
                    </p>
                  </div>
                  <Icon name="ChevronRight" size={18} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
            <div className="px-6 py-4 flex flex-col gap-2">
              <button onClick={() => { setPhone(''); setPhoneError(''); setMode('phone'); }}
                className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <Icon name="Phone" size={16} />Войти по номеру телефона
              </button>
              <div className="flex gap-2">
                <button onClick={() => setMode('qr')}
                  className="flex-1 h-10 rounded-md bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center justify-center gap-1.5">
                  <Icon name="QrCode" size={15} />QR-код
                </button>
                <button onClick={() => setMode('register')}
                  className="flex-1 h-10 rounded-md bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center justify-center gap-1.5">
                  <Icon name="UserPlus" size={15} />Новый аккаунт
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Ввод номера ── */}
        {mode === 'phone' && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
              <button onClick={() => setMode('accounts')} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                <Icon name="ArrowLeft" size={18} />
              </button>
              <h2 className="font-semibold text-base">Введите номер телефона</h2>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-muted-foreground">Мы отправим вам SMS с кодом подтверждения</p>
              <div>
                <label className="text-sm font-medium block mb-1.5">Номер телефона</label>
                <div className="relative">
                  <Icon name="Phone" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    autoFocus
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(formatPhone(e.target.value)); setPhoneError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                    placeholder="+7 900 000 0000"
                    className="w-full h-12 pl-9 pr-4 rounded-md bg-secondary text-base outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground font-mono tracking-wide"
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-destructive flex items-center gap-1.5 mt-2 animate-fade-in">
                    <Icon name="AlertCircle" size={13} />{phoneError}
                  </p>
                )}
              </div>
              <button onClick={sendCode} disabled={smsSending}
                className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                {smsSending ? <><Icon name="Loader" size={16} className="animate-spin" />Отправляем…</> : 'Получить код'}
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Демо: <span className="font-mono text-foreground">+7 900 000 0001</span>
              </p>
            </div>
          </div>
        )}

        {/* ── Ввод кода ── */}
        {mode === 'code' && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
              <button onClick={() => setMode('phone')} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                <Icon name="ArrowLeft" size={18} />
              </button>
              <h2 className="font-semibold text-base">Введите код</h2>
            </div>
            <div className="px-6 py-6 space-y-5">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Код отправлен на номер</p>
                <p className="font-semibold text-base font-mono">{formatPhone(phone)}</p>
              </div>

              {/* 4 поля для цифр */}
              <div className="flex items-center justify-center gap-3">
                {codeDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={codeRefs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeInput(i, e.target.value)}
                    onKeyDown={(e) => handleCodeKeyDown(i, e)}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
                      if (pasted.length > 0) {
                        const arr = pasted.split('').slice(0, 4);
                        const next = ['', '', '', ''];
                        arr.forEach((c, idx) => { next[idx] = c; });
                        setCodeDigits(next);
                        const focusIdx = Math.min(arr.length, 3);
                        codeRefs[focusIdx].current?.focus();
                        if (arr.length === 4) verifyCode(next);
                      }
                      e.preventDefault();
                    }}
                    className={`w-14 h-16 rounded-xl border-2 text-center text-2xl font-bold font-mono outline-none transition-all bg-secondary ${
                      digit ? 'border-primary text-primary' : 'border-border'
                    } ${codeError ? 'border-destructive animate-fade-in' : ''} focus:border-primary focus:ring-2 focus:ring-ring/20`}
                  />
                ))}
              </div>

              {codeError && (
                <p className="text-xs text-destructive flex items-center justify-center gap-1.5 animate-fade-in">
                  <Icon name="AlertCircle" size={13} />{codeError}
                </p>
              )}

              {/* Форма имени при первой регистрации */}
              {needName && (
                <div className="space-y-2 animate-fade-in border border-border rounded-lg p-4 bg-secondary/40">
                  <p className="text-xs font-medium text-muted-foreground">Первый вход — представьтесь</p>
                  <input autoFocus value={regNameInline} onChange={(e) => setRegNameInline(e.target.value)}
                    placeholder="Имя и фамилия *"
                    className="w-full h-10 px-3 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                  <input value={regRoleInline} onChange={(e) => setRegRoleInline(e.target.value)}
                    placeholder="Должность (необязательно)"
                    className="w-full h-10 px-3 rounded-md bg-secondary text-sm outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
                </div>
              )}

              {/* Подсказка для демо — только если SMS не настроен */}
              {smsDemo && generatedCode && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-start gap-2.5 animate-fade-in">
                  <Icon name="Info" size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Демо-режим. Ваш код: <span className="font-mono font-bold text-amber-900 dark:text-amber-200">{generatedCode}</span>
                  </p>
                </div>
              )}

              <button onClick={() => verifyCode()} disabled={verifying || (needName && !regNameInline.trim())}
                className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                {verifying ? <><Icon name="Loader" size={16} className="animate-spin" />Проверяем…</> : 'Подтвердить'}
              </button>

              {/* Повторная отправка */}
              <div className="text-center">
                {resendTimer > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Повторная отправка через <span className="font-mono text-foreground font-medium">{resendTimer}с</span>
                  </p>
                ) : (
                  <button onClick={sendCode} className="text-xs text-primary hover:underline underline-offset-2">
                    Отправить код повторно
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── QR ── */}
        {mode === 'qr' && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
              <button onClick={() => setMode('accounts')} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                <Icon name="ArrowLeft" size={18} />
              </button>
              <h2 className="font-semibold text-base">Вход по QR-коду</h2>
            </div>
            <div className="px-6 py-6 flex flex-col items-center text-center space-y-4">
              {!qrScanned ? (
                <>
                  <p className="text-sm text-muted-foreground">Откройте мессенджер на телефоне и отсканируйте код</p>
                  <div className="relative p-3 bg-white rounded-xl border border-border shadow-sm">
                    <QRCodeSVG value={QR_SESSION} size={180} bgColor="#ffffff" fgColor="#1e3a5f" level="M" marginSize={1} />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-9 h-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow">КМ</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon name="Clock" size={13} />Код действует <span className="font-mono text-foreground font-medium ml-1">{qrCountdown}с</span>
                  </div>
                  {qrCountdown === 0 && (
                    <button onClick={() => setMode('qr')} className="text-xs text-primary underline underline-offset-2">Обновить QR-код</button>
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
          </div>
        )}

        {/* ── Новый аккаунт ── */}
        {mode === 'register' && (
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
              <button onClick={() => setMode('accounts')} className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
                <Icon name="ArrowLeft" size={18} />
              </button>
              <h2 className="font-semibold text-base">Новый аккаунт</h2>
            </div>
            <form onSubmit={handleRegister} className="px-6 py-6 space-y-4">
              {/* Аватар */}
              <div className="flex items-center gap-4">
                <label className="relative cursor-pointer">
                  {regAvatar
                    ? <img src={regAvatar} alt="avatar" className="w-16 h-16 rounded-xl object-cover" />
                    : <div className="w-16 h-16 rounded-xl bg-secondary border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary transition-colors"><Icon name="Camera" size={24} /></div>
                  }
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setRegAvatar(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }} />
                </label>
                <div>
                  <p className="text-sm font-medium">{regName || 'Ваше имя'}</p>
                  <p className="text-xs text-muted-foreground">{regRole || 'Должность'}</p>
                  <p className="text-xs text-primary mt-1">Нажмите для фото</p>
                </div>
              </div>

              {[
                { label: 'Имя и фамилия *', val: regName, set: setRegName, placeholder: 'Иван Петров', type: 'text' },
                { label: 'Должность',       val: regRole, set: setRegRole, placeholder: 'Менеджер',    type: 'text' },
                { label: 'Номер телефона *', val: regPhone, set: (v: string) => setRegPhone(formatPhone(v)), placeholder: '+7 900 000 0000', type: 'tel' },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-sm font-medium block mb-1.5">{f.label}</label>
                  <input type={f.type} value={f.val} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder}
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
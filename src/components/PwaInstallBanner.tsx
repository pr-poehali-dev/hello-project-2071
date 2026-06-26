import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [shown, setShown] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Уже установлено?
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    const dismissed = localStorage.getItem('km-pwa-dismissed');
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      // Показываем баннер через 3 секунды
      setTimeout(() => setShown(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => { setInstalled(true); setShown(false); });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setShown(false);
  };

  const dismiss = () => {
    setShown(false);
    localStorage.setItem('km-pwa-dismissed', '1');
  };

  if (!shown || installed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl shadow-xl px-4 py-3 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">КМ</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Установить приложение</p>
          <p className="text-xs text-muted-foreground mt-0.5">Работает как обычное приложение</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={install}
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
            Установить
          </button>
          <button onClick={dismiss}
            className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
            <Icon name="X" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

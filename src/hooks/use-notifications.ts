import { useState, useEffect, useCallback, useRef } from 'react';

type Permission = 'default' | 'granted' | 'denied';

function playPing(ctx: AudioContext) {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.18, ctx.currentTime);
  master.connect(ctx.destination);

  // Два тона — мягкий аккорд
  const notes = [880, 1108]; // A5 + C#6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.01 + i * 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(master);
    osc.start(ctx.currentTime + i * 0.04);
    osc.stop(ctx.currentTime + 0.7);
  });
}

export function useNotifications() {
  const [permission, setPermission] = useState<Permission>('default');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission as Permission);
    }
    // Создаём AudioContext после первого взаимодействия пользователя
    const init = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      window.removeEventListener('click', init);
      window.removeEventListener('keydown', init);
    };
    window.addEventListener('click', init);
    window.addEventListener('keydown', init);
    return () => {
      window.removeEventListener('click', init);
      window.removeEventListener('keydown', init);
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied' as Permission;
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    return result as Permission;
  }, []);

  const playSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume().then(() => playPing(ctx));
      else playPing(ctx);
    } catch {
      // браузер без Web Audio — тихо пропускаем
    }
  }, [soundEnabled]);

  const notify = useCallback((title: string, body: string, tag?: string) => {
    // Звук
    playSound();

    // Визуальное уведомление
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag });
      }).catch(() => {
        new Notification(title, { body, icon: '/favicon.svg', tag });
      });
    } else {
      new Notification(title, { body, icon: '/favicon.svg', tag });
    }
  }, [playSound]);

  return { permission, requestPermission, notify, soundEnabled, setSoundEnabled };
}
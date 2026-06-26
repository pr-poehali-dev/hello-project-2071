import { useState, useEffect, useCallback, useRef } from 'react';

type Permission = 'default' | 'granted' | 'denied';

export type SoundId = 'ping' | 'chime' | 'drop' | 'pop' | 'bell';

export const SOUNDS: { id: SoundId; label: string; emoji: string }[] = [
  { id: 'ping',  label: 'Пинг',     emoji: '🔔' },
  { id: 'chime', label: 'Колокол',  emoji: '🎵' },
  { id: 'drop',  label: 'Капля',    emoji: '💧' },
  { id: 'pop',   label: 'Хлопок',   emoji: '🎈' },
  { id: 'bell',  label: 'Звонок',   emoji: '🔕' },
];

function getCtx(ref: React.MutableRefObject<AudioContext | null>): AudioContext {
  if (!ref.current) {
    ref.current = new (window.AudioContext || (window as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return ref.current;
}

function tone(ctx: AudioContext, freq: number, type: OscillatorType, start: number, dur: number, vol: number, master: GainNode) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

function makeMaster(ctx: AudioContext, vol: number): GainNode {
  const master = ctx.createGain();
  master.gain.setValueAtTime(vol, ctx.currentTime);
  master.connect(ctx.destination);
  return master;
}

const PLAYERS: Record<SoundId, (ctx: AudioContext) => void> = {
  // Мягкий двухтоновый аккорд
  ping: (ctx) => {
    const m = makeMaster(ctx, 0.18);
    tone(ctx, 880,  'sine', 0,    0.6, 1, m);
    tone(ctx, 1108, 'sine', 0.04, 0.6, 1, m);
  },
  // Нисходящий колокольный перезвон
  chime: (ctx) => {
    const m = makeMaster(ctx, 0.15);
    [1318, 1047, 784].forEach((f, i) => tone(ctx, f, 'sine', i * 0.12, 0.5, 1, m));
  },
  // Одна чистая капля
  drop: (ctx) => {
    const m = makeMaster(ctx, 0.2);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain); gain.connect(m);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  },
  // Короткий мягкий хлопок (шум + тон)
  pop: (ctx) => {
    const m = makeMaster(ctx, 0.22);
    // Шум
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5, ctx.currentTime);
    src.connect(ng); ng.connect(m); src.start(ctx.currentTime);
    // Тон
    tone(ctx, 440, 'sine', 0, 0.15, 0.6, m);
  },
  // Классический звонок (два удара)
  bell: (ctx) => {
    const m = makeMaster(ctx, 0.16);
    [0, 0.22].forEach((start) => {
      tone(ctx, 987,  'sine',   start,        0.5, 1,   m);
      tone(ctx, 1975, 'triangle', start,      0.3, 0.4, m);
      tone(ctx, 2960, 'triangle', start + 0.01, 0.2, 0.2, m);
    });
  },
};

export function useNotifications() {
  const [permission, setPermission] = useState<Permission>('default');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundId, setSoundId] = useState<SoundId>('ping');
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission as Permission);
    const init = () => {
      if (!audioCtxRef.current) getCtx(audioCtxRef);
      window.removeEventListener('click', init);
      window.removeEventListener('keydown', init);
    };
    window.addEventListener('click', init);
    window.addEventListener('keydown', init);
    return () => { window.removeEventListener('click', init); window.removeEventListener('keydown', init); };
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied' as Permission;
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    return result as Permission;
  }, []);

  const playSound = useCallback((id?: SoundId) => {
    if (!soundEnabled) return;
    try {
      const ctx = getCtx(audioCtxRef);
      const play = () => PLAYERS[id ?? soundId](ctx);
      if (ctx.state === 'suspended') ctx.resume().then(play);
      else play();
    } catch { /* нет Web Audio */ }
  }, [soundEnabled, soundId]);

  const notify = useCallback((title: string, body: string, tag?: string) => {
    playSound();
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag }))
        .catch(() => new Notification(title, { body, icon: '/favicon.svg', tag }));
    } else {
      new Notification(title, { body, icon: '/favicon.svg', tag });
    }
  }, [playSound]);

  return { permission, requestPermission, notify, soundEnabled, setSoundEnabled, soundId, setSoundId, playSound };
}

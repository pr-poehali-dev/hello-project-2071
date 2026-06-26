import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';

interface CallScreenProps {
  name: string;
  avatar: string;
  avatarUrl?: string | null;
  type: 'audio' | 'video';
  onClose: () => void;
}

type CallState = 'calling' | 'connected' | 'ended';

const CALL_DURATION_MAX = 3600;

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export default function CallScreen({ name, avatar, avatarUrl, type, onClose }: CallScreenProps) {
  const [callState, setCallState] = useState<CallState>('calling');
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [camOff, setCamOff] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Симуляция: через 2с «собеседник» отвечает
  useEffect(() => {
    const t = setTimeout(() => setCallState('connected'), 2000);
    return () => clearTimeout(t);
  }, []);

  // Таймер длительности
  useEffect(() => {
    if (callState !== 'connected') return;
    timerRef.current = setInterval(() => {
      setDuration((d) => {
        if (d >= CALL_DURATION_MAX) { clearInterval(timerRef.current!); return d; }
        return d + 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  // Камера для видеозвонка
  useEffect(() => {
    if (type !== 'video') return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {});
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [type]);

  // Вкл/выкл камера
  useEffect(() => {
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !camOff; });
  }, [camOff]);

  // Вкл/выкл микрофон
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }, [muted]);

  const hangUp = () => {
    setCallState('ended');
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(onClose, 1200);
  };

  const isVideo = type === 'video';

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-between overflow-hidden animate-fade-in ${isVideo ? 'bg-black' : 'bg-primary'}`}>

      {/* Фоновый градиент для аудио */}
      {!isVideo && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary via-primary to-blue-900 opacity-90" />
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        </div>
      )}

      {/* Видео собеседника (заглушка / анимация) */}
      {isVideo && callState === 'connected' && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-white/20 text-9xl font-bold select-none">{avatar}</div>
        </div>
      )}

      {/* Шапка */}
      <div className="relative w-full flex items-center justify-between px-6 pt-10 pb-4">
        <button onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
          <Icon name="ChevronDown" size={22} />
        </button>
        <div className="text-center">
          <p className="text-white/60 text-xs font-medium tracking-widest uppercase">
            {isVideo ? 'Видеозвонок' : 'Голосовой звонок'}
          </p>
        </div>
        <button onClick={() => setFullscreen((v) => !v)}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
          <Icon name={fullscreen ? 'Minimize2' : 'Maximize2'} size={18} />
        </button>
      </div>

      {/* Аватар и имя */}
      <div className="relative flex flex-col items-center gap-5 px-6">
        {/* Анимация пульса при звонке */}
        <div className="relative">
          {callState === 'calling' && (
            <>
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping scale-110" />
              <div className="absolute inset-0 rounded-full bg-white/10 animate-ping scale-125 [animation-delay:0.3s]" />
            </>
          )}
          {avatarUrl
            ? <img src={avatarUrl} alt={name} className="w-28 h-28 rounded-full object-cover border-4 border-white/20 relative z-10" />
            : (
              <div className="w-28 h-28 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center text-3xl font-bold text-white relative z-10">
                {avatar}
              </div>
            )
          }
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white tracking-tight">{name}</h2>
          <p className={`text-sm mt-1 font-mono ${callState === 'connected' ? 'text-green-300' : callState === 'ended' ? 'text-red-300' : 'text-white/60'}`}>
            {callState === 'calling'   && 'Вызов…'}
            {callState === 'connected' && formatDuration(duration)}
            {callState === 'ended'     && 'Звонок завершён'}
          </p>
        </div>
      </div>

      {/* Локальное видео (PiP) */}
      {isVideo && (
        <div className="relative self-end mr-6 mb-4">
          <div className={`w-28 h-36 rounded-xl overflow-hidden border-2 border-white/30 bg-slate-700 ${camOff ? 'flex items-center justify-center' : ''}`}>
            {camOff
              ? <Icon name="VideoOff" size={28} className="text-white/40" />
              : <video ref={localVideoRef} muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
            }
          </div>
        </div>
      )}

      {/* Панель управления */}
      <div className="relative w-full px-6 pb-14">
        <div className={`flex items-center justify-center gap-4 ${isVideo ? 'bg-black/40 backdrop-blur-md rounded-2xl py-5 px-4' : ''}`}>

          {/* Микрофон */}
          <button onClick={() => setMuted((v) => !v)}
            className={`flex flex-col items-center gap-2 group`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-red-500/80' : 'bg-white/15 hover:bg-white/25'}`}>
              <Icon name={muted ? 'MicOff' : 'Mic'} size={22} className="text-white" />
            </div>
            <span className="text-white/60 text-[11px]">{muted ? 'Включить' : 'Выключить'}</span>
          </button>

          {/* Завершить */}
          <button onClick={hangUp}
            className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg shadow-red-500/40">
              <Icon name="PhoneOff" size={26} className="text-white" />
            </div>
            <span className="text-white/60 text-[11px]">Завершить</span>
          </button>

          {/* Динамик / камера */}
          {isVideo ? (
            <button onClick={() => setCamOff((v) => !v)}
              className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${camOff ? 'bg-red-500/80' : 'bg-white/15 hover:bg-white/25'}`}>
                <Icon name={camOff ? 'VideoOff' : 'Video'} size={22} className="text-white" />
              </div>
              <span className="text-white/60 text-[11px]">{camOff ? 'Включить' : 'Выключить'}</span>
            </button>
          ) : (
            <button onClick={() => setSpeakerOn((v) => !v)}
              className="flex flex-col items-center gap-2">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${speakerOn ? 'bg-white/15 hover:bg-white/25' : 'bg-white/10'}`}>
                <Icon name={speakerOn ? 'Volume2' : 'VolumeX'} size={22} className="text-white" />
              </div>
              <span className="text-white/60 text-[11px]">{speakerOn ? 'Динамик' : 'Тихо'}</span>
            </button>
          )}
        </div>

        {/* Доп. кнопки для видео */}
        {isVideo && (
          <div className="flex items-center justify-center gap-6 mt-4">
            {[
              { icon: 'RotateCcw',   label: 'Камера'    },
              { icon: 'MonitorUp',   label: 'Экран'     },
              { icon: 'MessageSquare', label: 'Чат'     },
            ].map((btn) => (
              <button key={btn.icon} className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <Icon name={btn.icon} size={18} className="text-white" />
                </div>
                <span className="text-white/50 text-[10px]">{btn.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

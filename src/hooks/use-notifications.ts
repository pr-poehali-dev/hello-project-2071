import { useState, useEffect, useCallback } from 'react';

type Permission = 'default' | 'granted' | 'denied';

export function useNotifications() {
  const [permission, setPermission] = useState<Permission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission as Permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'denied' as Permission;
    const result = await Notification.requestPermission();
    setPermission(result as Permission);
    return result as Permission;
  }, []);

  const notify = useCallback((title: string, body: string, tag?: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    // Через Service Worker для надёжности на мобильных
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag });
      }).catch(() => {
        // Fallback — прямое уведомление
        new Notification(title, { body, icon: '/favicon.svg', tag });
      });
    } else {
      new Notification(title, { body, icon: '/favicon.svg', tag });
    }
  }, []);

  return { permission, requestPermission, notify };
}

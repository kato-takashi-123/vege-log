import { useState, useEffect, useCallback } from 'react';

export const useServiceWorker = () => {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const onUpdate = useCallback((reg: ServiceWorkerRegistration) => {
    if (reg.waiting) {
      setWaitingWorker(reg.waiting);
      setUpdateAvailable(true);
    } else {
      const newWorker = reg.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setUpdateAvailable(true);
          }
        });
      }
    }
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          setRegistration(reg);
          reg.addEventListener('updatefound', () => {
            onUpdate(reg);
          });
          // Check if a waiting worker already exists
          if (reg.waiting) {
            setWaitingWorker(reg.waiting);
            setUpdateAvailable(true);
          }
        })
        .catch(err => {
          console.log('ServiceWorker registration failed: ', err);
        });
    }
  }, [onUpdate]);

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.addEventListener('statechange', (event) => {
        // @ts-ignore
        if (event.target.state === 'activated') {
          window.location.reload();
        }
      });
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [waitingWorker]);

  const checkForUpdate = useCallback(() => {
    registration?.update().catch(err => {
       console.error("Update check failed:", err);
    });
  }, [registration]);

  return {
    updateAvailable,
    applyUpdate,
    checkForUpdate,
  };
};

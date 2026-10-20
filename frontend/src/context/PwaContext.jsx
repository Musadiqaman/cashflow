import { createContext, useContext, useEffect, useRef, useState } from 'react';
const PwaContext = createContext(null);
export function PwaProvider({ children }) {
  const [prompt, setPrompt] = useState(null),
    [update, setUpdate] = useState(null),
    [installed, setInstalled] = useState(
      matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    );
  const reloading = useRef(false),
    updateRequested = useRef(false);
  useEffect(() => {
    const installEvent = (event) => {
        event.preventDefault();
        setPrompt(event);
      },
      done = () => {
        setPrompt(null);
        setInstalled(true);
      };
    window.addEventListener('beforeinstallprompt', installEvent);
    window.addEventListener('appinstalled', done);
    const onController = () => {
      if (updateRequested.current && !reloading.current) {
        reloading.current = true;
        window.location.reload();
      }
    };
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (reg.waiting) setUpdate(reg.waiting);
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller)
                setUpdate(worker);
            });
          });
        })
        .catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', onController);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', installEvent);
      window.removeEventListener('appinstalled', done);
      navigator.serviceWorker?.removeEventListener('controllerchange', onController);
    };
  }, []);
  const install = async () => {
    if (!prompt) return false;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
    return true;
  };
  return (
    <PwaContext.Provider
      value={{
        canInstall: !!prompt,
        installed,
        install,
        update,
        applyUpdate: () => {
          updateRequested.current = true;
          update?.postMessage({ type: 'SKIP_WAITING' });
        },
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}
export const usePwa = () => useContext(PwaContext);

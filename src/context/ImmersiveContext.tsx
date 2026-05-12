import { createContext, useContext, useState, ReactNode } from 'react';

interface ImmersiveContextType {
  isImmersive: boolean;
  toggleImmersive: () => void;
  setImmersive: (value: boolean) => void;
  isKiosk: boolean;
  toggleKiosk: () => void;
}

const ImmersiveContext = createContext<ImmersiveContextType>({
  isImmersive: false,
  toggleImmersive: () => {},
  setImmersive: () => {},
  isKiosk: false,          // ← add
  toggleKiosk: () => {},   // ← add
});

export function ImmersiveProvider({ children }: { children: ReactNode }) {
  const [isImmersive, setIsImmersive] = useState(() => {
    try {
      const stored = localStorage.getItem('immersive-mode');
      return stored === null ? true : stored === 'true';
    } catch {
      return false;
    }
  });

  const [isKiosk, setIsKiosk] = useState(() => {       // ← add
    try {
      return localStorage.getItem('kiosk-mode') === 'true';
    } catch {
      return false;
    }
  });

  const setImmersive = (value: boolean) => {
    setIsImmersive(value);
    try {
      localStorage.setItem('immersive-mode', value ? 'true' : 'false');
    } catch {}
  };

  const toggleImmersive = () => setImmersive(!isImmersive);

  const toggleKiosk = () => {                          // ← add
    const next = !isKiosk;
    setIsKiosk(next);
    try { localStorage.setItem('kiosk-mode', next ? 'true' : 'false'); } catch {}
  };

  return (
    <ImmersiveContext.Provider value={{ isImmersive, toggleImmersive, setImmersive, isKiosk, toggleKiosk }}>
      {children}
    </ImmersiveContext.Provider>
  );
}

export const useImmersive = () => useContext(ImmersiveContext);
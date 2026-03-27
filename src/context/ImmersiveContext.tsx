import { createContext, useContext, useState, ReactNode } from 'react';

interface ImmersiveContextType {
  isImmersive: boolean;
  toggleImmersive: () => void;
  setImmersive: (value: boolean) => void;
}

const ImmersiveContext = createContext<ImmersiveContextType>({
  isImmersive: false,
  toggleImmersive: () => {},
  setImmersive: () => {},
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

  const setImmersive = (value: boolean) => {
    setIsImmersive(value);
    try {
      localStorage.setItem('immersive-mode', value ? 'true' : 'false');
    } catch {}
  };

  const toggleImmersive = () => setImmersive(!isImmersive);

  return (
    <ImmersiveContext.Provider value={{ isImmersive, toggleImmersive, setImmersive }}>
      {children}
    </ImmersiveContext.Provider>
  );
}

export const useImmersive = () => useContext(ImmersiveContext);

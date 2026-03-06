import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface MainHeaderContextType {
  header: ReactNode | null;
  setHeader: (header: ReactNode | null) => void;
  firstTabActive: boolean;
  setFirstTabActive: (active: boolean) => void;
}

const MainHeaderContext = createContext<MainHeaderContextType>({
  header: null,
  setHeader: () => {},
  firstTabActive: false,
  setFirstTabActive: () => {},
});

export function MainHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<ReactNode | null>(null);
  const [firstTabActive, setFirstTabActive] = useState(false);
  return (
    <MainHeaderContext.Provider value={{ header, setHeader, firstTabActive, setFirstTabActive }}>
      {children}
    </MainHeaderContext.Provider>
  );
}

export function useMainHeader() {
  return useContext(MainHeaderContext);
}

/** Set a header element that renders in the transparent area above MainContent's opaque container. */
export function useSetMainHeader(header: ReactNode | null, firstTabActive = false) {
  const { setHeader, setFirstTabActive } = useMainHeader();
  useEffect(() => {
    setHeader(header);
    setFirstTabActive(firstTabActive);
    return () => {
      setHeader(null);
      setFirstTabActive(false);
    };
  }, [header, firstTabActive, setHeader, setFirstTabActive]);
}

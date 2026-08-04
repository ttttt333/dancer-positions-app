import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ProUpgradeModal,
  type ProUpgradeReason,
} from "./ProUpgradeModal";

type ProUpgradeContextValue = {
  requestProUpgrade: (reason: ProUpgradeReason) => void;
};

const ProUpgradeContext = createContext<ProUpgradeContextValue | null>(null);

export function ProUpgradeProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ProUpgradeReason>("dancer_limit");

  const requestProUpgrade = useCallback((next: ProUpgradeReason) => {
    setReason(next);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ requestProUpgrade }), [requestProUpgrade]);

  return (
    <ProUpgradeContext.Provider value={value}>
      {children}
      <ProUpgradeModal
        open={open}
        reason={reason}
        onClose={() => setOpen(false)}
      />
    </ProUpgradeContext.Provider>
  );
}

export function useProUpgrade(): ProUpgradeContextValue {
  const ctx = useContext(ProUpgradeContext);
  if (!ctx) {
    return {
      requestProUpgrade: () => {
        /* Provider 外では何もしない */
      },
    };
  }
  return ctx;
}

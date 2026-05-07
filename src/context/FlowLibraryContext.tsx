import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { FlowLibraryItem } from "../lib/flowLibrary";
import { listFlowLibraryItems } from "../lib/flowLibrary";

interface FlowLibraryContextType {
  items: FlowLibraryItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const FlowLibraryContext = createContext<FlowLibraryContextType | null>(null);

export function FlowLibraryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FlowLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const libraryItems = await listFlowLibraryItems();
      setItems(libraryItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load library");
      console.error("Failed to load flow library:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) {
      refresh();
      setIsInitialized(true);
    }
  }, [refresh, isInitialized]); // 初回のみ実行

  return (
    <FlowLibraryContext.Provider value={{ items, loading, error, refresh }}>
      {children}
    </FlowLibraryContext.Provider>
  );
}

export const useFlowLibrary = () => {
  const context = useContext(FlowLibraryContext);
  if (!context) {
    throw new Error("useFlowLibrary must be used within FlowLibraryProvider");
  }
  return context;
};

"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

type SubmissionView = {
  id: string;
  subject: string;
  created_at: string;
  updated_at: string;
  editable: boolean;
  edit_deadline: string;
  photo_file_ids: string[];
  note: string;
  review: {
    status: "pending" | "reviewed" | "returned";
    score?: number;
    comment?: string;
    reviewed_at?: string;
    reviewer?: string;
  };
};

type MeResponse = {
  registered: boolean;
  student?: { name: string };
  subjects: string[];
  submissions: SubmissionView[];
  assignments: Array<{
    id: string;
    subject: string;
    title: string;
    description?: string;
    due_date?: string;
    active: boolean;
  }>;
};

type MeContextValue = {
  loading: boolean;
  syncing: boolean;
  me: MeResponse | null;
  error: string | null;
  refresh: () => Promise<void>;
  setError: (value: string | null) => void;
  setMe: Dispatch<SetStateAction<MeResponse | null>>;
};

const MeContext = createContext<MeContextValue | null>(null);

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  useEffect(() => {
    hasDataRef.current = Boolean(me);
  }, [me]);

  const refresh = useCallback(async () => {
    if (hasDataRef.current) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch("/api/me", { credentials: "include" });
      const data = (await res.json()) as MeResponse;
      if (!res.ok) {
        setError("加载失败，请稍后再试");
        return;
      }
      setMe(data);
    } catch (err) {
      setError("加载失败，请稍后再试");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      loading,
      syncing,
      me,
      error,
      refresh,
      setError,
      setMe
    }),
    [loading, syncing, me, error, refresh]
  );

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe() {
  const context = useContext(MeContext);
  if (!context) {
    throw new Error("useMe must be used within MeProvider");
  }
  return context;
}

export type { MeResponse, SubmissionView };

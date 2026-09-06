import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  loadWorkspace,
  saveWorkspace,
  seedSampleData,
  clearSampleData,
  resetWorkspace,
  hasAnyRealData,
  newId,
  upsertBy,
  removeBy,
} from "./storage";
import type { Workspace } from "./types";

interface WorkspaceContextValue {
  workspace: Workspace;
  ready: boolean;
  update: (updater: (ws: Workspace) => Workspace) => void;
  seedSample: () => void;
  clearSample: () => void;
  resetAll: () => void;
  hasRealData: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>(() => loadWorkspace());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setWorkspace(loadWorkspace());
    setReady(true);
  }, []);

  const update = useCallback((updater: (ws: Workspace) => Workspace) => {
    setWorkspace((prev) => {
      const next = updater(prev);
      saveWorkspace(next);
      return next;
    });
  }, []);

  const seedSample = useCallback(() => setWorkspace(seedSampleData()), []);
  const clearSample = useCallback(() => setWorkspace(clearSampleData()), []);
  const resetAll = useCallback(() => setWorkspace(resetWorkspace()), []);

  const value: WorkspaceContextValue = {
    workspace,
    ready,
    update,
    seedSample,
    clearSample,
    resetAll,
    hasRealData: hasAnyRealData(workspace),
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}

export { newId, upsertBy, removeBy };

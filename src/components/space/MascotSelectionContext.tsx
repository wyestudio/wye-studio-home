"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_MASCOT_ID, isMascotId, type MascotId } from "@/lib/mascots";

const STORAGE_KEY = "wye-selected-mascot";
const CHANGE_EVENT = "wye-mascot-selection-change";

function readStoredMascot(): MascotId {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isMascotId(stored) ? stored : DEFAULT_MASCOT_ID;
}

function getServerSnapshot(): MascotId {
  return DEFAULT_MASCOT_ID;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

type MascotSelectionValue = {
  selectedMascot: MascotId;
  selectMascot: (id: MascotId) => void;
};

const MascotSelectionContext = createContext<MascotSelectionValue>({
  selectedMascot: DEFAULT_MASCOT_ID,
  selectMascot: () => {},
});

export function MascotSelectionProvider({ children }: { children: ReactNode }) {
  const selectedMascot = useSyncExternalStore(subscribe, readStoredMascot, getServerSnapshot);

  function selectMascot(id: MascotId) {
    window.localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <MascotSelectionContext.Provider value={{ selectedMascot, selectMascot }}>
      {children}
    </MascotSelectionContext.Provider>
  );
}

export function useMascotSelection() {
  return useContext(MascotSelectionContext);
}

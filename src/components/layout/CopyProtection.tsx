"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const EXCLUDED_PREFIXES = ["/lookup", "/admin"];

type CopyProtectionContextValue = {
  requestExemption: () => () => void;
};

const CopyProtectionContext = createContext<CopyProtectionContextValue | null>(null);

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return !!target.closest("input, textarea, [contenteditable='true']");
}

export function CopyProtectionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [exemptCount, setExemptCount] = useState(0);

  const routeExcluded = EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  const protectionActive = !routeExcluded && exemptCount === 0;

  useEffect(() => {
    document.documentElement.classList.toggle("copy-protected", protectionActive);
  }, [protectionActive]);

  useEffect(() => {
    if (!protectionActive) return;

    const handleContextMenu = (e: MouseEvent) => {
      if (!isEditableTarget(e.target)) e.preventDefault();
    };
    const handleCopyCut = (e: ClipboardEvent) => {
      if (!isEditableTarget(e.target)) e.preventDefault();
    };
    const handleDragStart = (e: DragEvent) => {
      if (!isEditableTarget(e.target)) e.preventDefault();
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyCut);
    document.addEventListener("cut", handleCopyCut);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyCut);
      document.removeEventListener("cut", handleCopyCut);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, [protectionActive]);

  const requestExemption = () => {
    setExemptCount((c) => c + 1);
    return () => setExemptCount((c) => c - 1);
  };

  return (
    <CopyProtectionContext.Provider value={{ requestExemption }}>
      {children}
    </CopyProtectionContext.Provider>
  );
}

export function useCopyProtectionExemption() {
  const ctx = useContext(CopyProtectionContext);

  useEffect(() => {
    if (!ctx) return;
    return ctx.requestExemption();
  }, [ctx]);
}

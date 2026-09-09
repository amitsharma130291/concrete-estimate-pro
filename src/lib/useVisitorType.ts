import { useEffect, useState } from "react";

/**
 * Self-reported "who is this calculation for" — per-visit only (sessionStorage), never
 * claimed as cross-device or persistent. Drives how strongly the Pro preview panel pitches:
 * quiet for a homeowner pricing their own property, full for someone pricing a customer job.
 * Answering is always optional; every calculator works identically either way.
 */
export type VisitorType = "property" | "customer" | null;

const KEY = "ccp.visitorType";
export const VISITOR_TYPE_EVENT = "ccp:visitor-type-changed";

export function getVisitorType(): VisitorType {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(KEY);
    return v === "property" || v === "customer" ? v : null;
  } catch {
    return null;
  }
}

function setStoredVisitorType(type: VisitorType): void {
  if (typeof window === "undefined") return;
  try {
    if (type) sessionStorage.setItem(KEY, type);
    else sessionStorage.removeItem(KEY);
  } catch {
    // sessionStorage unavailable (private browsing, etc.) -- the toggle still works for the
    // current render via the event below, it just won't survive a page navigation.
  }
  window.dispatchEvent(new CustomEvent<VisitorType>(VISITOR_TYPE_EVENT, { detail: type }));
}

/** Independently-mounted calculator islands (dimensions calculator, Pro preview panel, mobile
 * sticky bar) all need to react to the same choice without sharing a React tree -- the
 * window event keeps them in sync the same way license state does elsewhere in this app. */
export function useVisitorType(): [VisitorType, (type: VisitorType) => void] {
  // Starts at null (matching the server-rendered default) and picks up any stored value only
  // after mount -- reading sessionStorage during the initial render would hydrate to a
  // different value than the server rendered, which React flags as a mismatch.
  const [type, setType] = useState<VisitorType>(null);

  useEffect(() => {
    setType(getVisitorType());
    function onChange(e: Event) {
      setType((e as CustomEvent<VisitorType>).detail);
    }
    window.addEventListener(VISITOR_TYPE_EVENT, onChange);
    return () => window.removeEventListener(VISITOR_TYPE_EVENT, onChange);
  }, []);

  return [type, setStoredVisitorType];
}

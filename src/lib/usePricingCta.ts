import { useEffect, useState } from "react";
import { LICENSE_STORED_EVENT, getStoredLicense } from "./license";

/**
 * A "buy Pro" CTA embedded in the free calculator islands should point at
 * the app instead of re-selling it to a visitor who already owns it. React
 * version of pricingCtaSwap.ts's DOM-swap approach -- these CTAs are already
 * client-rendered React, so a hook is the natural fit instead of querying
 * the DOM out from under React.
 */
export function usePricingCta(defaultLabel: string): { href: string; label: string } {
  const [licensed, setLicensed] = useState(() => Boolean(getStoredLicense()));

  useEffect(() => {
    function onStored() {
      setLicensed(true);
    }
    window.addEventListener(LICENSE_STORED_EVENT, onStored);
    return () => window.removeEventListener(LICENSE_STORED_EVENT, onStored);
  }, []);

  return licensed ? { href: "/app", label: "Go to App" } : { href: "/pricing", label: defaultLabel };
}

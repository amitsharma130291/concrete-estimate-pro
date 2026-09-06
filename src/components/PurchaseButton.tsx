import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "./ui/primitives";
import { track } from "../lib/analytics";

// TODO: wire this button to a real checkout provider (e.g. Dodo Payments or Stripe) once
// this product has payment credentials configured. Until then it's a safe placeholder —
// it never collects card details and never claims a purchase has completed.
export default function PurchaseButton() {
  const [clicked, setClicked] = useState(false);

  function handleClick() {
    track("checkout_started", { price: 79 });
    setClicked(true);
  }

  return (
    <div>
      <Button
        size="lg"
        className="w-full shadow-[0_8px_30px_-8px_rgba(255,90,31,0.7)]"
        onClick={handleClick}
      >
        Get Concrete Cost Pro — $79 Launch Price
        <ArrowRight size={18} />
      </Button>
      {clicked && (
        <p role="status" className="mt-3 rounded-lg border border-border bg-warm-white p-3 text-center text-sm text-muted">
          Checkout isn't connected yet. This is a placeholder — no payment has been taken.
        </p>
      )}
    </div>
  );
}

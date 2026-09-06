import { useState } from "react";
import { Button } from "./ui/primitives";

// TODO: wire this button to a real checkout provider (e.g. Dodo Payments or Stripe) once
// this product has payment credentials configured. Until then it's a safe placeholder —
// it never collects card details and never claims a purchase has completed.
export default function PurchaseButton() {
  const [clicked, setClicked] = useState(false);

  return (
    <div>
      <Button size="lg" className="w-full" onClick={() => setClicked(true)}>
        Get Concrete Estimate Pro — $99 Lifetime
      </Button>
      {clicked && (
        <p role="status" className="mt-3 rounded-lg border border-border bg-warm-white p-3 text-center text-sm text-muted">
          Checkout isn't connected yet. This is a placeholder — no payment has been taken.
        </p>
      )}
    </div>
  );
}

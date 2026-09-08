import { useEffect } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/primitives";
import { usePricingCta } from "../../lib/usePricingCta";
import { useVisitorType } from "../../lib/useVisitorType";
import { track } from "../../lib/analytics";

/**
 * Context-aware "what would this look like in Pro" panel, rendered directly below a
 * calculator's result. `whatHappens` should describe what happens to *this* calculation
 * specifically (see each call site) -- never a generic feature list. Quiets down to a single
 * link, instead of the full pitch, when the visitor has self-identified as pricing their own
 * property rather than a customer job.
 */
export default function ProPreviewPanel({
  heading = "Estimate jobs like this regularly?",
  body,
  whatHappens,
  ctaLabel,
  source,
}: {
  heading?: string;
  body: string;
  whatHappens: string[];
  ctaLabel: string;
  source: string;
}) {
  const pricingCta = usePricingCta(ctaLabel);
  const [visitorType] = useVisitorType();
  const quiet = visitorType === "property";

  useEffect(() => {
    track("pro_preview_opened", { source, variant: quiet ? "quiet" : "full" });
    // Only re-fire if the variant itself changes (visitor answers the toggle mid-visit) --
    // not on every unrelated re-render of the parent calculator.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiet, source]);

  if (quiet) {
    return (
      <p className="mt-4 text-center text-sm text-muted">
        Estimating this for a customer instead?{" "}
        <a href={pricingCta.href} className="font-medium text-orange hover:underline">
          See how Concrete Cost Pro saves your rates →
        </a>
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-orange/25 bg-orange/5 p-5">
      <h3 className="font-semibold text-ink">{heading}</h3>
      <p className="mt-1.5 text-sm text-muted">{body}</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {whatHappens.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink/85">
            <CheckCircle2 size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-orange" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
      <a href={pricingCta.href}>
        <Button size="lg" className="mt-4 w-full">
          {pricingCta.label}
          <ArrowRight size={18} />
        </Button>
      </a>
      <p className="mt-2 text-center text-xs text-muted">$79 one-time purchase · No monthly subscription · 14-day refund</p>
    </div>
  );
}

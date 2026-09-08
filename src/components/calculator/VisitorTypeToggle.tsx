import { useVisitorType } from "../../lib/useVisitorType";
import { track } from "../../lib/analytics";

/**
 * Optional self-identification -- never required to use a calculator. Answering just changes
 * how the Pro preview panel below the result talks: quiet for a homeowner pricing their own
 * property, fuller for someone pricing a customer job. See useVisitorType for the storage.
 */
export default function VisitorTypeToggle() {
  const [visitorType, setVisitorType] = useVisitorType();

  function choose(type: "property" | "customer") {
    setVisitorType(visitorType === type ? null : type);
    track("visitor_type_selected", { visitor_type: type });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Are you calculating for:</span>
      <div role="group" aria-label="Who this calculation is for" className="inline-flex overflow-hidden rounded-full border border-border">
        <button
          type="button"
          onClick={() => choose("property")}
          aria-pressed={visitorType === "property"}
          className={`px-3 py-1.5 font-medium transition ${
            visitorType === "property" ? "bg-orange text-white" : "bg-white text-ink hover:bg-warm-white"
          }`}
        >
          My property
        </button>
        <button
          type="button"
          onClick={() => choose("customer")}
          aria-pressed={visitorType === "customer"}
          className={`border-l border-border px-3 py-1.5 font-medium transition ${
            visitorType === "customer" ? "bg-orange text-white" : "bg-white text-ink hover:bg-warm-white"
          }`}
        >
          A customer job
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Printer, ArrowRight } from "lucide-react";
import { Button, Card, Field, NumberInput, TextInput } from "../ui/primitives";
import { formatCurrency, formatPercent, calculateRequiredSellingPrice, calculateMargin } from "../../lib/calc";
import { track } from "../../lib/analytics";
import { usePricingCta } from "../../lib/usePricingCta";

interface LineItem {
  id: string;
  label: string;
  amount: number;
}

let idCounter = 0;
function newLineId() {
  idCounter += 1;
  return `line-${idCounter}`;
}

export default function EstimateTemplateIsland() {
  const pricingCta = usePricingCta("Build This Estimate From Saved Rates");
  const [view, setView] = useState<"customer" | "internal">("customer");
  const [overheadPercent, setOverheadPercent] = useState(15);
  const [targetMarginPercent, setTargetMarginPercent] = useState(30);
  const [contractor, setContractor] = useState("ABC Concrete Co.");
  const [contractorPhone, setContractorPhone] = useState("(555) 210-4488");
  const [customer, setCustomer] = useState("Smith Residence");
  const [projectType, setProjectType] = useState("Concrete Driveway");
  const [scope, setScope] = useState("80 ft x 18 ft, 4in thick, broom finish, includes forms and reinforcement.");
  const [notes, setNotes] = useState("Estimate valid for 30 days. 50% deposit to schedule, balance due on completion.");
  const [items, setItems] = useState<LineItem[]>([
    { id: newLineId(), label: "Ready mix concrete (17.2 yd³)", amount: 2838 },
    { id: newLineId(), label: "Labor", amount: 3400 },
    { id: newLineId(), label: "Forms & reinforcement", amount: 1500 },
    { id: newLineId(), label: "Equipment & pump", amount: 750 },
  ]);

  const total = useMemo(() => items.reduce((sum, i) => sum + (Number.isFinite(i.amount) ? i.amount : 0), 0), [items]);
  // Internal-view-only math -- the line items above are direct cost; overhead and target
  // margin are never part of the customer-facing total or printed document.
  const trueCost = total * (1 + overheadPercent / 100);
  const requiredPrice = calculateRequiredSellingPrice(trueCost, targetMarginPercent);
  const currentMarginAtTotal = calculateMargin(total, trueCost);

  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-US"));
  }, []);

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function addItem() {
    setItems((prev) => [...prev, { id: newLineId(), label: "New line item", amount: 0 }]);
  }
  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm no-print">
        <span className="text-muted">Viewing as:</span>
        <div role="group" aria-label="Document view" className="inline-flex overflow-hidden rounded-full border border-border">
          <button
            type="button"
            onClick={() => setView("customer")}
            aria-pressed={view === "customer"}
            className={`px-3 py-1.5 font-medium transition ${view === "customer" ? "bg-orange text-white" : "bg-white text-ink hover:bg-warm-white"}`}
          >
            Customer view
          </button>
          <button
            type="button"
            onClick={() => setView("internal")}
            aria-pressed={view === "internal"}
            className={`border-l border-border px-3 py-1.5 font-medium transition ${view === "internal" ? "bg-orange text-white" : "bg-white text-ink hover:bg-warm-white"}`}
          >
            Internal view (cost, overhead, margin)
          </button>
        </div>
        <span className="text-xs text-muted">The internal view is never printed or sent to the customer.</span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[55%_45%] lg:items-start">
      <div className="flex flex-col gap-6 no-print">
        <Card title="Contractor & Customer">
          <Field label="Contractor" htmlFor="et-contractor">
            <TextInput id="et-contractor" value={contractor} onChange={(e) => setContractor(e.target.value)} />
          </Field>
          <Field label="Phone" htmlFor="et-phone">
            <TextInput id="et-phone" value={contractorPhone} onChange={(e) => setContractorPhone(e.target.value)} />
          </Field>
          <Field label="Customer" htmlFor="et-customer">
            <TextInput id="et-customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </Field>
          <Field label="Project type" htmlFor="et-project-type">
            <TextInput id="et-project-type" value={projectType} onChange={(e) => setProjectType(e.target.value)} />
          </Field>
        </Card>

        <Card title="Scope of work">
          <label htmlFor="et-scope" className="sr-only">
            Scope of work
          </label>
          <textarea
            id="et-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-orange"
          />
        </Card>

        <Card title="Line items">
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <TextInput
                  aria-label="Line item description"
                  value={item.label}
                  onChange={(e) => updateItem(item.id, { label: e.target.value })}
                  className="flex-1"
                />
                <div className="flex w-32 overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
                  <span className="flex items-center border-r border-border bg-warm-white px-2 text-xs text-muted">$</span>
                  <NumberInput
                    aria-label={`Amount for ${item.label || "line item"}`}
                    value={item.amount}
                    onChange={(e) => updateItem(item.id, { amount: e.target.value === "" ? 0 : parseFloat(e.target.value) })}
                    className="rounded-none border-0 shadow-none focus:border-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.label}`}
                  className="rounded-lg p-2 text-muted hover:bg-red-light hover:text-red"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="mt-3" onClick={addItem}>
            <Plus size={16} /> Add line item
          </Button>
        </Card>

        <Card title="Notes">
          <label htmlFor="et-notes" className="sr-only">
            Notes
          </label>
          <textarea
            id="et-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-orange"
          />
        </Card>
      </div>

      <div className="lg:sticky lg:top-6">
        <p className="no-print mb-2 inline-flex items-center gap-1.5 rounded-full bg-warm-white px-3 py-1 text-xs font-semibold text-muted">
          Sample estimate — every field is editable. Replace it with your own project.
        </p>
        <div className="rounded-xl border border-border bg-white p-6 shadow-sm print:border-0 print:shadow-none">
          <div className="flex items-start justify-between border-b border-border pb-4">
            <div>
              <div className="text-lg font-bold text-ink">{contractor}</div>
              <div className="text-sm text-muted">{contractorPhone}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-wide text-orange">Project Estimate</div>
              <div className="text-xs text-muted">{today}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs uppercase text-muted">Customer</div>
              <div className="font-medium text-ink">{customer}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted">Project</div>
              <div className="font-medium text-ink">{projectType}</div>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted">{scope}</p>

          <div className="mt-5 divide-y divide-border border-y border-border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">{item.label}</span>
                <span className="font-medium text-ink">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-base font-semibold text-ink">Estimated project total</span>
            <span className="text-2xl font-bold text-green">{formatCurrency(total)}</span>
          </div>

          {view === "internal" && (
            <div className="no-print mt-4 rounded-lg border border-orange/30 bg-orange/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-orange">Internal only</span>
                <span className="text-xs text-muted">Never shown to the customer</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Overhead" htmlFor="et-overhead">
                  <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
                    <NumberInput id="et-overhead" value={overheadPercent} onChange={(e) => setOverheadPercent(parseFloat(e.target.value) || 0)} className="rounded-none border-0 shadow-none focus:border-0" />
                    <span className="flex items-center border-l border-border bg-warm-white px-2 text-xs text-muted">%</span>
                  </div>
                </Field>
                <Field label="Target margin" htmlFor="et-margin">
                  <div className="flex overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
                    <NumberInput id="et-margin" value={targetMarginPercent} onChange={(e) => setTargetMarginPercent(parseFloat(e.target.value) || 0)} className="rounded-none border-0 shadow-none focus:border-0" />
                    <span className="flex items-center border-l border-border bg-warm-white px-2 text-xs text-muted">%</span>
                  </div>
                </Field>
                <div>
                  <div className="text-xs text-muted">True cost</div>
                  <div className="font-semibold text-ink">{formatCurrency(trueCost)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Required price</div>
                  <div className="font-semibold text-ink">{formatCurrency(requiredPrice)}</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted">
                Direct cost (line items above) {formatCurrency(total)} + {overheadPercent}% overhead ={" "}
                {formatCurrency(trueCost)} true cost. At the current project total of {formatCurrency(total)}, that's{" "}
                {formatPercent(currentMarginAtTotal, 0)} margin{currentMarginAtTotal !== null && currentMarginAtTotal < targetMarginPercent / 100 ? ", below your target" : ""}.
                To hit {targetMarginPercent}%, the price needs to be {formatCurrency(requiredPrice)}.
              </p>
            </div>
          )}

          {notes && <p className="mt-4 text-xs text-muted">{notes}</p>}

          <div className="mt-6 flex flex-col gap-2 no-print">
            <Button size="md" onClick={() => { track("pdf_generated", { source: "free_estimate_template" }); window.print(); }}>
              <Printer size={16} /> Print / Save as PDF
            </Button>
            <a href={pricingCta.href}>
              <Button size="md" variant="ghost" className="w-full">
                {pricingCta.label}
                <ArrowRight size={16} />
              </Button>
            </a>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

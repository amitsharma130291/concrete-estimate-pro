import { useState } from "react";
import { Plus, Printer, Trash2 } from "lucide-react";
import { Button, Card, Field, TextInput } from "../ui/primitives";
import { NumericField } from "./SupplyTools";
import { invoiceTotals } from "../../lib/supplyCalculators";
import { formatCurrency as currency } from "../../lib/calc";
import { track } from "../../lib/analytics";
const formatCurrency = (value: number) => currency(value, { cents: true });

export default function InvoiceTool() {
  const [details, setDetails] = useState({
    company: "",
    companyAddress: "",
    customer: "",
    customerAddress: "",
    project: "",
    number: "INV-1001",
    date: "",
    due: "",
    notes: "",
    payment: "",
  });
  const [lines, setLines] = useState([
    {
      description: "Completed concrete work",
      unit: "job",
      quantity: 1,
      rate: 0,
      taxable: false,
    },
  ]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [paid, setPaid] = useState(0);
  const update = (i: number, patch: Partial<(typeof lines)[number]>) =>
    setLines(lines.map((line, j) => (i === j ? { ...line, ...patch } : line)));
  let totals: ReturnType<typeof invoiceTotals> | null = null;
  let error = "";
  try {
    totals = invoiceTotals(lines, taxPercent, paid);
  } catch (e) {
    error = e instanceof Error ? e.message : "Check the invoice values.";
  }
  const missing =
    !details.company.trim() ||
    !details.customer.trim() ||
    !details.number.trim() ||
    !details.date ||
    !details.due ||
    !lines.every((line) => line.description.trim()) ||
    (details.date && details.due < details.date);
  const printable = Boolean(totals && totals.total > 0 && !missing);
  function print() {
    if (!printable) return;
    track("invoice_printed", { source: "concrete_invoice_template" });
    window.print();
  }
  return (
    <div className="invoice-tool grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-5 no-print">
        <Card title="Invoice details">
          <p className="mb-3 text-sm text-muted">
            Free USD invoice generator. Nothing is submitted or saved between
            visits. Fill in your own details before printing.
          </p>
          {(
            [
              ["company", "Business name"],
              ["companyAddress", "Business address/contact"],
              ["customer", "Customer name"],
              ["customerAddress", "Billing address"],
              ["project", "Job address / completed scope"],
              ["number", "Invoice number"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label} htmlFor={`inv-${key}`} wide>
              <TextInput
                id={`inv-${key}`}
                value={details[key]}
                onChange={(e) =>
                  setDetails({ ...details, [key]: e.target.value })
                }
              />
            </Field>
          ))}
          {(
            [
              ["date", "Invoice date"],
              ["due", "Payment due date"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label} htmlFor={`inv-${key}`} wide>
              <input
                className="w-full rounded-lg border border-border px-3 py-2"
                id={`inv-${key}`}
                type="date"
                value={details[key]}
                min={key === "due" ? details.date || undefined : undefined}
                onChange={(e) =>
                  setDetails({ ...details, [key]: e.target.value })
                }
              />
            </Field>
          ))}
        </Card>
        <Card title="Completed work and charges">
          <div className="space-y-4">
            {lines.map((line, i) => (
              <fieldset key={i} className="rounded-lg border border-border p-3">
                <legend className="px-1 text-sm font-semibold">
                  Line {i + 1}
                </legend>
                <Field
                  label="Description"
                  htmlFor={`inv-description-${i}`}
                  wide
                >
                  <TextInput
                    id={`inv-description-${i}`}
                    value={line.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                  />
                </Field>
                <Field label="Unit" htmlFor={`inv-unit-${i}`} wide>
                  <TextInput
                    id={`inv-unit-${i}`}
                    value={line.unit}
                    onChange={(e) => update(i, { unit: e.target.value })}
                  />
                </Field>
                <NumericField
                  id={`inv-quantity-${i}`}
                  label="Quantity"
                  value={line.quantity}
                  onChange={(quantity) => update(i, { quantity })}
                />
                <NumericField
                  id={`inv-rate-${i}`}
                  label="Rate ($ per unit)"
                  value={line.rate}
                  onChange={(rate) => update(i, { rate })}
                />
                <label className="flex items-center gap-2 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={line.taxable}
                    onChange={(e) => update(i, { taxable: e.target.checked })}
                  />
                  Apply tax to line {i + 1}
                </label>
                {lines.length > 1 && (
                  <Button
                    variant="ghost"
                    onClick={() => setLines(lines.filter((_, j) => i !== j))}
                  >
                    <Trash2 size={16} /> Remove line {i + 1}
                  </Button>
                )}
              </fieldset>
            ))}
          </div>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() =>
              setLines([
                ...lines,
                {
                  description: "",
                  unit: "job",
                  quantity: 1,
                  rate: 0,
                  taxable: false,
                },
              ])
            }
          >
            <Plus size={16} /> Add invoice line
          </Button>
        </Card>
        <Card title="Tax, payments and terms">
          <NumericField
            id="inv-tax"
            label="Tax on selected lines (%)"
            value={taxPercent}
            max={100}
            onChange={setTaxPercent}
          />
          <NumericField
            id="inv-paid"
            label="Payments/deposits received ($)"
            value={paid}
            onChange={setPaid}
          />
          <Field label="Payment instructions" htmlFor="inv-payment" wide>
            <TextInput
              id="inv-payment"
              value={details.payment}
              onChange={(e) =>
                setDetails({ ...details, payment: e.target.value })
              }
            />
          </Field>
          <Field label="Notes / approved changes" htmlFor="inv-notes" wide>
            <textarea
              id="inv-notes"
              rows={3}
              value={details.notes}
              onChange={(e) =>
                setDetails({ ...details, notes: e.target.value })
              }
              className="w-full rounded-lg border border-border px-3 py-2"
            />
          </Field>
        </Card>
      </div>
      <div className="min-w-0">
        <div className="mb-4 no-print">
          <Button disabled={!printable} onClick={print}>
            <Printer size={16} /> Print / Save invoice as PDF
          </Button>
          {!printable && (
            <p className="mt-2 text-sm text-muted">
              Enter business, customer, invoice number, valid issue/due dates,
              descriptions and a positive total to print.
            </p>
          )}
        </div>
        <article
          className="invoice-document rounded-xl border border-border bg-white p-5 shadow-sm sm:p-8"
          aria-label="Invoice preview"
        >
          <div className="flex flex-wrap justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">
                {details.company || "Your business"}
              </h2>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                {details.companyAddress}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-xl font-bold">INVOICE</p>
              <p>{details.number}</p>
              <p>Issued: {details.date || "Not entered"}</p>
              <p>Due: {details.due || "Not entered"}</p>
            </div>
          </div>
          <div className="my-6 text-sm">
            <p className="font-semibold">
              Bill to: {details.customer || "Your customer"}
            </p>
            <p className="break-words">{details.customerAddress}</p>
            <p className="mt-3 break-words">{details.project}</p>
          </div>
          {error ? (
            <p role="alert" className="text-red">
              {error} Invoice totals are hidden until corrected.
            </p>
          ) : (
            totals && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Invoice charges in US dollars
                    </caption>
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-2">Completed work</th>
                        <th className="px-2 py-2">Qty</th>
                        <th className="px-2 py-2">Rate</th>
                        <th className="py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="max-w-56 break-words py-3">
                            {line.description || `Line ${i + 1}`}
                            <span className="block text-xs text-muted">
                              {line.unit}
                              {line.taxable ? " · taxable" : ""}
                            </span>
                          </td>
                          <td className="px-2">
                            {Number.isFinite(line.quantity)
                              ? line.quantity
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-2">
                            {formatCurrency(line.rate)}
                          </td>
                          <td className="whitespace-nowrap text-right">
                            {formatCurrency(totals!.amounts[i])}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <dl
                  className="ml-auto mt-5 max-w-sm space-y-2 text-sm"
                  aria-live="polite"
                >
                  {(
                    [
                      ["Subtotal", totals.subtotal],
                      ["Tax", totals.tax],
                      ["Invoice total", totals.total],
                      ["Payments received", paid],
                      ["Balance due", totals.balance],
                      ...(totals.credit > 0
                        ? [
                            ["Overpayment credit", totals.credit] as [
                              string,
                              number,
                            ],
                          ]
                        : []),
                    ] as [string, number][]
                  ).map(([label, amount]) => (
                    <div
                      key={label}
                      className={`flex justify-between gap-4 ${label === "Balance due" ? "border-t border-border pt-3 text-lg font-bold" : ""}`}
                    >
                      <dt>{label}</dt>
                      <dd>{formatCurrency(amount)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )
          )}
          <p className="mt-6 whitespace-pre-wrap break-words text-sm">
            {details.payment}
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm">
            {details.notes}
          </p>
          <p className="mt-6 text-xs text-muted">
            Currency: USD. Invoice covers the listed completed work and approved
            charges.
          </p>
        </article>
      </div>
    </div>
  );
}

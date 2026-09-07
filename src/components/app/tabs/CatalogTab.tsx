import { useMemo, useRef, useState } from "react";
import { Download, PlusCircle, Trash2, Upload } from "lucide-react";
import { newId, removeBy, upsertBy, useWorkspace } from "../../../lib/workspaceContext";
import { downloadCsv as downloadCsvRows } from "../../../lib/csv";
import type { CatalogItem, EquipmentItem, LaborRateItem } from "../../../lib/types";
import { Button, Card, EmptyState, NumberInput, Tabs, TextInput } from "../../ui/primitives";

type SubTab = "readyMix" | "materials" | "labor" | "equipment";

export default function CatalogTab() {
  const [sub, setSub] = useState<SubTab>("readyMix");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Catalog</h1>
        <p className="text-sm text-muted">Your saved rates. All pricing here is whatever you enter — nothing is fetched automatically.</p>
      </div>

      <Tabs
        tabs={[
          { key: "readyMix", label: "Ready Mix" },
          { key: "materials", label: "Materials" },
          { key: "labor", label: "Labor" },
          { key: "equipment", label: "Equipment" },
        ]}
        active={sub}
        onChange={(k) => setSub(k as SubTab)}
      />

      {sub === "readyMix" && <CatalogItemsPanel kind="readyMix" title="Ready mix concrete" />}
      {sub === "materials" && <CatalogItemsPanel kind="material" title="Materials" />}
      {sub === "labor" && <LaborPanel />}
      {sub === "equipment" && <EquipmentPanel />}
    </div>
  );
}

function CatalogItemsPanel({ kind, title }: { kind: CatalogItem["kind"]; title: string }) {
  const { catalog, updateCatalog } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => catalog.materials.filter((c) => c.kind === kind), [catalog.materials, kind]);

  function addRow() {
    const item: CatalogItem = { id: newId("cat"), kind, name: "New item", supplier: "", unit: kind === "readyMix" ? "yd³" : "each", unitCost: 0 };
    updateCatalog((c) => ({ ...c, materials: upsertBy(c.materials, item) }));
  }
  function patch(id: string, p: Partial<CatalogItem>) {
    updateCatalog((c) => ({ ...c, materials: c.materials.map((m) => (m.id === id ? { ...m, ...p } : m)) }));
  }
  function remove(id: string) {
    updateCatalog((c) => ({ ...c, materials: removeBy(c.materials, id) }));
  }

  function exportCsv() {
    const rows = [["name", "supplier", "unit", "unitCost"], ...items.map((i) => [i.name, i.supplier ?? "", i.unit, String(i.unitCost)])];
    downloadCsvRows(`${kind}-catalog.csv`, rows);
  }
  function importCsv(file: File) {
    file.text().then((text) => {
      const parsed = parseCsv(text);
      const imported: CatalogItem[] = parsed.map((row) => ({
        id: newId("cat"),
        kind,
        name: row.name ?? "Imported item",
        supplier: row.supplier ?? "",
        unit: row.unit ?? "each",
        unitCost: parseFloat(row.unitCost ?? "0") || 0,
      }));
      updateCatalog((c) => ({ ...c, materials: [...c.materials, ...imported] }));
    });
  }

  return (
    <Card
      title={title}
      subtitle={`${items.length} item${items.length === 1 ? "" : "s"}`}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={addRow}>
          <PlusCircle size={15} /> Add item
        </Button>
        <Button size="sm" variant="ghost" onClick={exportCsv}>
          <Download size={15} /> Export CSV
        </Button>
        <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Import CSV
        </Button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nothing here yet" desc="Add an item or import a CSV to build your catalog." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase text-muted">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Supplier</th>
                <th className="pb-2 font-medium">Unit</th>
                <th className="pb-2 font-medium">Unit cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 pr-2">
                    <TextInput value={i.name} onChange={(e) => patch(i.id, { name: e.target.value })} />
                  </td>
                  <td className="py-2 pr-2">
                    <TextInput value={i.supplier ?? ""} onChange={(e) => patch(i.id, { supplier: e.target.value })} />
                  </td>
                  <td className="py-2 pr-2 w-24">
                    <TextInput value={i.unit} onChange={(e) => patch(i.id, { unit: e.target.value })} />
                  </td>
                  <td className="py-2 pr-2 w-32">
                    <NumberInput value={i.unitCost} onChange={(e) => patch(i.id, { unitCost: parseFloat(e.target.value) || 0 })} />
                  </td>
                  <td className="py-2">
                    <button type="button" onClick={() => remove(i.id)} aria-label={`Remove ${i.name}`} className="rounded-lg p-1.5 text-muted hover:bg-red-light hover:text-red">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LaborPanel() {
  const { catalog, updateCatalog, preferences } = useWorkspace();
  function addRow() {
    const item: LaborRateItem = { id: newId("lab"), name: "New crew rate", loadedRatePerHour: preferences.defaultLoadedLaborRate };
    updateCatalog((c) => ({ ...c, laborRates: upsertBy(c.laborRates, item) }));
  }
  function patch(id: string, p: Partial<LaborRateItem>) {
    updateCatalog((c) => ({ ...c, laborRates: c.laborRates.map((r) => (r.id === id ? { ...r, ...p } : r)) }));
  }
  function remove(id: string) {
    updateCatalog((c) => ({ ...c, laborRates: removeBy(c.laborRates, id) }));
  }

  return (
    <Card title="Labor rates" subtitle={`${catalog.laborRates.length} rate${catalog.laborRates.length === 1 ? "" : "s"}`}>
      <Button size="sm" onClick={addRow} className="mb-3">
        <PlusCircle size={15} /> Add labor rate
      </Button>
      {catalog.laborRates.length === 0 ? (
        <EmptyState title="No labor rates yet" desc="Add your loaded hourly rate to speed up job costing." />
      ) : (
        <div className="flex flex-col gap-2">
          {catalog.laborRates.map((l) => (
            <div key={l.id} className="flex items-center gap-2">
              <TextInput value={l.name} onChange={(e) => patch(l.id, { name: e.target.value })} className="flex-1" />
              <div className="flex w-36 overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
                <span className="flex items-center border-r border-border bg-warm-white px-2 text-xs text-muted">$</span>
                <NumberInput value={l.loadedRatePerHour} onChange={(e) => patch(l.id, { loadedRatePerHour: parseFloat(e.target.value) || 0 })} className="rounded-none border-0 shadow-none focus:border-0" />
                <span className="flex items-center border-l border-border bg-warm-white px-2 text-xs text-muted">/hr</span>
              </div>
              <button type="button" onClick={() => remove(l.id)} aria-label={`Remove ${l.name}`} className="rounded-lg p-1.5 text-muted hover:bg-red-light hover:text-red">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EquipmentPanel() {
  const { catalog, updateCatalog } = useWorkspace();
  function addRow() {
    const item: EquipmentItem = { id: newId("eq"), name: "New equipment", unit: "per job", cost: 0 };
    updateCatalog((c) => ({ ...c, equipment: upsertBy(c.equipment, item) }));
  }
  function patch(id: string, p: Partial<EquipmentItem>) {
    updateCatalog((c) => ({ ...c, equipment: c.equipment.map((eq) => (eq.id === id ? { ...eq, ...p } : eq)) }));
  }
  function remove(id: string) {
    updateCatalog((c) => ({ ...c, equipment: removeBy(c.equipment, id) }));
  }

  return (
    <Card title="Equipment" subtitle={`${catalog.equipment.length} item${catalog.equipment.length === 1 ? "" : "s"}`}>
      <Button size="sm" onClick={addRow} className="mb-3">
        <PlusCircle size={15} /> Add equipment
      </Button>
      {catalog.equipment.length === 0 ? (
        <EmptyState title="No equipment yet" desc="Add pumps, saws or rentals you commonly bill to jobs." />
      ) : (
        <div className="flex flex-col gap-2">
          {catalog.equipment.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <TextInput value={e.name} onChange={(ev) => patch(e.id, { name: ev.target.value })} className="flex-1" />
              <select
                value={e.unit}
                onChange={(ev) => patch(e.id, { unit: ev.target.value as EquipmentItem["unit"] })}
                className="rounded-lg border border-border px-2 py-2 text-sm shadow-sm focus:border-orange"
              >
                <option value="per job">per job</option>
                <option value="per day">per day</option>
                <option value="per hour">per hour</option>
              </select>
              <div className="flex w-32 overflow-hidden rounded-lg border border-border shadow-sm focus-within:border-orange">
                <span className="flex items-center border-r border-border bg-warm-white px-2 text-xs text-muted">$</span>
                <NumberInput value={e.cost} onChange={(ev) => patch(e.id, { cost: parseFloat(ev.target.value) || 0 })} className="rounded-none border-0 shadow-none focus:border-0" />
              </div>
              <button type="button" onClick={() => remove(e.id)} aria-label={`Remove ${e.name}`} className="rounded-lg p-1.5 text-muted hover:bg-red-light hover:text-red">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Splits one CSV line honoring RFC 4180 quoting (a comma inside a quoted field is not a
 * delimiter, and `""` inside a quoted field is a literal `"`) -- unlike a bare
 * `line.split(",")`, which mis-parses any quoted field containing a comma. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

import { useMemo, useRef, useState } from "react";
import { Download, PlusCircle, Trash2, Upload } from "lucide-react";
import { useWorkspace } from "../../../lib/workspaceContext";
import { newId, removeBy, upsertBy } from "../../../lib/storage";
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
  const { workspace, update } = useWorkspace();
  const fileRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => workspace.catalog.filter((c) => c.kind === kind), [workspace.catalog, kind]);

  function addRow() {
    const item: CatalogItem = { id: newId("cat"), kind, name: "New item", supplier: "", unit: kind === "readyMix" ? "yd³" : "each", unitCost: 0 };
    update((ws) => ({ ...ws, catalog: upsertBy(ws.catalog, item) }));
  }
  function patch(id: string, p: Partial<CatalogItem>) {
    update((ws) => ({ ...ws, catalog: ws.catalog.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  }
  function remove(id: string) {
    update((ws) => ({ ...ws, catalog: removeBy(ws.catalog, id) }));
  }

  function exportCsv() {
    const rows = [["name", "supplier", "unit", "unitCost"], ...items.map((i) => [i.name, i.supplier ?? "", i.unit, String(i.unitCost)])];
    downloadCsv(`${kind}-catalog.csv`, rows);
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
      update((ws) => ({ ...ws, catalog: [...ws.catalog, ...imported] }));
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
  const { workspace, update } = useWorkspace();
  function addRow() {
    const item: LaborRateItem = { id: newId("lab"), name: "New crew rate", loadedRatePerHour: workspace.settings.defaultLoadedLaborRate };
    update((ws) => ({ ...ws, laborRates: upsertBy(ws.laborRates, item) }));
  }
  function patch(id: string, p: Partial<LaborRateItem>) {
    update((ws) => ({ ...ws, laborRates: ws.laborRates.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  }
  function remove(id: string) {
    update((ws) => ({ ...ws, laborRates: removeBy(ws.laborRates, id) }));
  }

  return (
    <Card title="Labor rates" subtitle={`${workspace.laborRates.length} rate${workspace.laborRates.length === 1 ? "" : "s"}`}>
      <Button size="sm" onClick={addRow} className="mb-3">
        <PlusCircle size={15} /> Add labor rate
      </Button>
      {workspace.laborRates.length === 0 ? (
        <EmptyState title="No labor rates yet" desc="Add your loaded hourly rate to speed up job costing." />
      ) : (
        <div className="flex flex-col gap-2">
          {workspace.laborRates.map((l) => (
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
  const { workspace, update } = useWorkspace();
  function addRow() {
    const item: EquipmentItem = { id: newId("eq"), name: "New equipment", unit: "per job", cost: 0 };
    update((ws) => ({ ...ws, equipment: upsertBy(ws.equipment, item) }));
  }
  function patch(id: string, p: Partial<EquipmentItem>) {
    update((ws) => ({ ...ws, equipment: ws.equipment.map((c) => (c.id === id ? { ...c, ...p } : c)) }));
  }
  function remove(id: string) {
    update((ws) => ({ ...ws, equipment: removeBy(ws.equipment, id) }));
  }

  return (
    <Card title="Equipment" subtitle={`${workspace.equipment.length} item${workspace.equipment.length === 1 ? "" : "s"}`}>
      <Button size="sm" onClick={addRow} className="mb-3">
        <PlusCircle size={15} /> Add equipment
      </Button>
      {workspace.equipment.length === 0 ? (
        <EmptyState title="No equipment yet" desc="Add pumps, saws or rentals you commonly bill to jobs." />
      ) : (
        <div className="flex flex-col gap-2">
          {workspace.equipment.map((e) => (
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

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row;
  });
}

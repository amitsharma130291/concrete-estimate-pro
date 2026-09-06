import { PlusCircle, Trash2 } from "lucide-react";
import { newId } from "../../lib/storage";
import type { ProjectSection } from "../../lib/types";
import { Button, NumberInput, TextInput } from "../ui/primitives";
import { combinedNetCubicYards } from "../../lib/estimateMath";
import { formatYd3 } from "../../lib/calc";

export default function SectionsEditor({ sections, onChange }: { sections: ProjectSection[]; onChange: (s: ProjectSection[]) => void }) {
  function addSection() {
    onChange([...sections, { id: newId("sec"), name: `Section ${sections.length + 1}`, lengthFt: 10, widthFt: 10, thicknessIn: 4 }]);
  }
  function patch(id: string, p: Partial<ProjectSection>) {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }
  function remove(id: string) {
    if (sections.length <= 1) return;
    onChange(sections.filter((s) => s.id !== id));
  }

  return (
    <div>
      <div className="flex flex-col gap-2">
        {sections.map((s) => (
          <div key={s.id} className="grid grid-cols-[1fr_repeat(3,80px)_auto] items-center gap-2 rounded-lg border border-border p-2">
            <TextInput value={s.name} onChange={(e) => patch(s.id, { name: e.target.value })} aria-label="Section name" />
            <LabeledNum label="L (ft)" value={s.lengthFt} onChange={(v) => patch(s.id, { lengthFt: v })} />
            <LabeledNum label="W (ft)" value={s.widthFt} onChange={(v) => patch(s.id, { widthFt: v })} />
            <LabeledNum label="T (in)" value={s.thicknessIn} onChange={(v) => patch(s.id, { thicknessIn: v })} />
            <button
              type="button"
              onClick={() => remove(s.id)}
              disabled={sections.length <= 1}
              aria-label={`Remove ${s.name}`}
              className="rounded-lg p-1.5 text-muted hover:bg-red-light hover:text-red disabled:opacity-30"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <Button size="sm" variant="ghost" onClick={addSection}>
          <PlusCircle size={14} /> Add section
        </Button>
        <span className="text-xs text-muted">Combined: {formatYd3(combinedNetCubicYards(sections))} net</span>
      </div>
    </div>
  );
}

function LabeledNum({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase text-muted">{label}</span>
      <NumberInput value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className="px-2 py-1.5" />
    </label>
  );
}

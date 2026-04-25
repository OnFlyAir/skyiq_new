import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WeightChipsInputProps {
  /** Comma-separated string, e.g. "180, 200, 165" */
  value: string;
  onChange: (next: string) => void;
  /** Optional fixed labels for each slot (e.g. ["PIC", "SIC", "FA"]) */
  slotLabels?: string[];
  /** Default weight to add when user adds a new chip */
  defaultWeight?: number;
  /** Allow adding/removing chips. If false, chips are fixed by slotLabels */
  allowAddRemove?: boolean;
  unit?: string;
  addLabel?: string;
}

function parseWeights(value: string): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((w) => parseFloat(w.trim()))
    .map((w) => (isNaN(w) ? 0 : w));
}

function serialize(weights: number[]): string {
  return weights.join(", ");
}

export default function WeightChipsInput({
  value,
  onChange,
  slotLabels,
  defaultWeight = 180,
  allowAddRemove = true,
  unit = "lbs",
  addLabel = "Add",
}: WeightChipsInputProps) {
  const weights = parseWeights(value);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex !== null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingIndex]);

  const updateWeight = (idx: number, val: number) => {
    const next = [...weights];
    next[idx] = val;
    onChange(serialize(next));
  };

  const removeWeight = (idx: number) => {
    const next = weights.filter((_, i) => i !== idx);
    onChange(serialize(next));
  };

  const addWeight = () => {
    onChange(serialize([...weights, defaultWeight]));
    setEditingIndex(weights.length);
    setDraft(String(defaultWeight));
  };

  const commitDraft = () => {
    if (editingIndex === null) return;
    const num = parseFloat(draft);
    updateWeight(editingIndex, isNaN(num) ? 0 : num);
    setEditingIndex(null);
  };

  const startEdit = (idx: number) => {
    setDraft(String(weights[idx] ?? 0));
    setEditingIndex(idx);
  };

  const total = weights.reduce((sum, w) => sum + w, 0);

  return (
    <div className="rounded-md border border-input bg-background p-2">
      <div className="flex flex-wrap gap-1.5">
        {weights.map((w, i) => {
          const isEditing = editingIndex === i;
          const label = slotLabels?.[i];
          return (
            <div
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-muted pl-2 pr-1 py-0.5 text-sm"
            >
              {label && (
                <span className="text-xs font-medium text-muted-foreground">
                  {label}
                </span>
              )}
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="numeric"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitDraft();
                    } else if (e.key === "Escape") {
                      setEditingIndex(null);
                    }
                  }}
                  className="w-14 bg-transparent text-sm tabular-nums focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(i)}
                  className="tabular-nums hover:text-primary"
                >
                  {w}
                </button>
              )}
              {allowAddRemove && (
                <button
                  type="button"
                  onClick={() => removeWeight(i)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-background"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {allowAddRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addWeight}
            className="h-7 px-2 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            {addLabel}
          </Button>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{weights.length} {weights.length === 1 ? "person" : "people"}</span>
        <span className="tabular-nums">Total: {total} {unit}</span>
      </div>
    </div>
  );
}

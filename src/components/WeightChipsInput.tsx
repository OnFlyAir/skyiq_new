import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  /**
   * Slot mode: each position corresponds to a fixed labeled slot.
   * - Chips with value 0 are hidden but their slot is preserved.
   * - Removing a chip sets that slot's value to 0 (hidden).
   * - Re-add via dropdown listing currently-hidden slots.
   * - The slot at `requiredSlotIndex` cannot be removed.
   */
  slotMode?: boolean;
  requiredSlotIndex?: number;
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
  slotMode = false,
  requiredSlotIndex = 0,
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
    while (next.length <= idx) next.push(0);
    next[idx] = val;
    onChange(serialize(next));
  };

  const removeWeight = (idx: number) => {
    if (slotMode) {
      // Preserve slot positions; just zero this slot.
      updateWeight(idx, 0);
      return;
    }
    const next = weights.filter((_, i) => i !== idx);
    onChange(serialize(next));
  };

  const addWeight = () => {
    onChange(serialize([...weights, defaultWeight]));
    setEditingIndex(weights.length);
    setDraft(String(defaultWeight));
  };

  const restoreSlot = (idx: number) => {
    updateWeight(idx, defaultWeight);
    setEditingIndex(idx);
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

  // In slot mode, hide chips whose value is 0 unless they are being edited.
  const visibleIndices = weights
    .map((_, i) => i)
    .filter((i) => !slotMode || weights[i] > 0 || editingIndex === i);

  // Hidden slots (slotMode only) that can be restored.
  const hiddenSlots =
    slotMode && slotLabels
      ? slotLabels
          .map((label, i) => ({ label, i }))
          .filter(({ i }) => weights[i] === 0 && editingIndex !== i && i !== requiredSlotIndex)
      : [];

  const total = weights.reduce((sum, w) => sum + w, 0);
  const peopleCount = slotMode
    ? weights.filter((w) => w > 0).length
    : weights.length;

  return (
    <div className="rounded-md border border-input bg-background p-2">
      <div className="flex flex-wrap gap-1.5">
        {visibleIndices.map((i) => {
          const w = weights[i];
          const isEditing = editingIndex === i;
          const label = slotLabels?.[i];
          const canRemove = slotMode
            ? i !== requiredSlotIndex
            : allowAddRemove;
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
              {canRemove && (
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

        {slotMode && hiddenSlots.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                {addLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {hiddenSlots.map(({ label, i }) => (
                <DropdownMenuItem key={i} onClick={() => restoreSlot(i)}>
                  Add {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!slotMode && allowAddRemove && (
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
        <span>{peopleCount} {peopleCount === 1 ? "person" : "people"}</span>
        <span className="tabular-nums">Total: {total} {unit}</span>
      </div>
    </div>
  );
}

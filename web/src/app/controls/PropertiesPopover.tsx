import { Palette, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import type {
  AtomPropertyControlState,
  AtomPropertyOption,
  PropertyFilterOperator,
} from "../../model/atomProperties";
import { TOOL_ICON_BUTTON_ACTIVE_CLASS, TOOL_ICON_BUTTON_CLASS } from "../surface";

const OPERATORS: { label: string; value: PropertyFilterOperator }[] = [
  { label: "<", value: "lt" },
  { label: "≤", value: "lte" },
  { label: "=", value: "eq" },
  { label: "≠", value: "neq" },
  { label: "≥", value: "gte" },
  { label: ">", value: "gt" },
  { label: "between", value: "between" },
];

export function PropertiesPopover({
  state,
  options,
  colorOptions = options,
  loading,
  error,
  matchCount,
  onChange,
  onSelectMatches,
}: {
  state: AtomPropertyControlState;
  options: readonly AtomPropertyOption[];
  colorOptions?: readonly AtomPropertyOption[];
  loading: boolean;
  error?: string | null;
  matchCount?: number | null;
  onChange: (state: AtomPropertyControlState) => void;
  onSelectMatches: () => void;
}) {
  const active = state.colorPropertyId !== null || state.filterEnabled;
  const update = (patch: Partial<AtomPropertyControlState>) => onChange({ ...state, ...patch });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Atomic properties"
          aria-pressed={active}
          className={`${TOOL_ICON_BUTTON_CLASS} ${active ? TOOL_ICON_BUTTON_ACTIVE_CLASS : "text-muted-foreground"}`}
        >
          <Palette aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={10}
        className="w-[320px] max-h-[calc(100vh-2rem)] overflow-y-auto p-3"
      >
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-xs font-semibold">Atomic properties</h3>
            <p className="text-[10px] text-muted-foreground">
              Color atoms or apply a live visibility mask.
            </p>
          </div>

          <section className="flex flex-col gap-1.5 border-t border-border pt-2">
            <label className="text-[10px] font-medium text-muted-foreground">Coloring</label>
            <select
              aria-label="Color atoms by property"
              value={state.colorPropertyId ?? ""}
              className="h-7 rounded border border-border bg-background px-2 text-[11px]"
              onChange={(event) => update({
                colorPropertyId: event.currentTarget.value || null,
                manualDomain: null,
              })}
            >
              <option value="">Element colors</option>
              {colorOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {state.colorPropertyId ? (
              <>
                <select
                  aria-label="Property color palette"
                  value={state.palette}
                  className="h-7 rounded border border-border bg-background px-2 text-[11px]"
                  onChange={(event) => update({
                    palette: event.currentTarget.value as AtomPropertyControlState["palette"],
                  })}
                >
                  <option value="viridis">Viridis</option>
                  <option value="plasma">Plasma</option>
                  <option value="cividis">Cividis</option>
                  <option value="coolwarm">Coolwarm</option>
                </select>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  Range
                  <input
                    aria-label="Property color minimum"
                    placeholder="auto"
                    value={state.manualDomain?.min ?? ""}
                    className="h-6 min-w-0 flex-1 rounded border border-border px-1 font-mono"
                    onChange={(event) => {
                      if (event.currentTarget.value.trim() === "") {
                        update({ manualDomain: null });
                        return;
                      }
                      const min = Number(event.currentTarget.value);
                      const max = state.manualDomain?.max ?? min + 1;
                      update({ manualDomain: Number.isFinite(min)
                        ? { min, max }
                        : null });
                    }}
                  />
                  <input
                    aria-label="Property color maximum"
                    placeholder="auto"
                    value={state.manualDomain?.max ?? ""}
                    className="h-6 min-w-0 flex-1 rounded border border-border px-1 font-mono"
                    onChange={(event) => {
                      if (event.currentTarget.value.trim() === "") {
                        update({ manualDomain: null });
                        return;
                      }
                      const max = Number(event.currentTarget.value);
                      const min = state.manualDomain?.min ?? max - 1;
                      update({ manualDomain: Number.isFinite(max)
                        ? { min, max }
                        : null });
                    }}
                  />
                  <button
                    type="button"
                    className="rounded px-1 py-0.5 hover:bg-muted"
                    onClick={() => update({ manualDomain: null })}
                  >
                    Auto
                  </button>
                </div>
              </>
            ) : null}
          </section>

          <section className="flex flex-col gap-2 border-t border-border pt-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[10px] font-medium">
                <input
                  type="checkbox"
                  checked={state.filterEnabled}
                  className="size-3 accent-foreground"
                  onChange={(event) => update({ filterEnabled: event.currentTarget.checked })}
                />
                Live filter
              </label>
              <div role="group" aria-label="Property filter logic" className="text-[10px]">
                {(["and", "or"] as const).map((logic) => (
                  <button
                    key={logic}
                    type="button"
                    aria-pressed={state.filterLogic === logic}
                    className={`border px-2 py-0.5 uppercase first:rounded-l last:rounded-r ${state.filterLogic === logic ? "bg-foreground text-background" : "text-muted-foreground"}`}
                    onClick={() => update({ filterLogic: logic })}
                  >
                    {logic}
                  </button>
                ))}
              </div>
            </div>

            {state.conditions.map((condition) => (
              <div key={condition.id} className="grid grid-cols-[1fr_4.5rem_4rem_auto] gap-1">
                <select
                  aria-label="Filter property"
                  value={condition.propertyId}
                  className="h-7 min-w-0 rounded border border-border bg-background px-1 text-[10px]"
                  onChange={(event) => update({ conditions: state.conditions.map((entry) =>
                    entry.id === condition.id
                      ? { ...entry, propertyId: event.currentTarget.value }
                      : entry) })}
                >
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <select
                  aria-label="Filter operator"
                  value={condition.operator}
                  className="h-7 rounded border border-border bg-background px-1 text-[10px]"
                  onChange={(event) => update({ conditions: state.conditions.map((entry) =>
                    entry.id === condition.id
                      ? { ...entry, operator: event.currentTarget.value as PropertyFilterOperator }
                      : entry) })}
                >
                  {OPERATORS.map((operator) => (
                    <option key={operator.value} value={operator.value}>{operator.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  aria-label="Filter value"
                  value={condition.value}
                  className="h-7 min-w-0 rounded border border-border px-1 font-mono text-[10px]"
                  onChange={(event) => update({ conditions: state.conditions.map((entry) =>
                    entry.id === condition.id
                      ? { ...entry, value: Number(event.currentTarget.value) }
                      : entry) })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove property filter"
                  className="size-7"
                  onClick={() => update({
                    conditions: state.conditions.filter((entry) => entry.id !== condition.id),
                  })}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
                {condition.operator === "between" ? (
                  <input
                    type="number"
                    aria-label="Filter upper value"
                    value={condition.upperValue ?? condition.value}
                    className="col-start-3 h-7 min-w-0 rounded border border-border px-1 font-mono text-[10px]"
                    onChange={(event) => update({ conditions: state.conditions.map((entry) =>
                      entry.id === condition.id
                        ? { ...entry, upperValue: Number(event.currentTarget.value) }
                        : entry) })}
                  />
                ) : null}
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={options.length === 0}
                onClick={() => {
                  const propertyId = options[0]?.id;
                  if (!propertyId) return;
                  update({ conditions: [
                    ...state.conditions,
                    { id: crypto.randomUUID(), propertyId, operator: "lt", value: 0 },
                  ] });
                }}
              >
                <Plus aria-hidden="true" />
                Condition
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={matchCount === null || matchCount === undefined}
                onClick={onSelectMatches}
              >
                Select current matches
              </Button>
              <span className="text-[10px] text-muted-foreground">
                {loading ? "Computing…" : matchCount === null || matchCount === undefined
                  ? "No active result"
                  : `${matchCount} matches`}
              </span>
            </div>
            {error ? <p role="alert" className="text-[10px] text-red-600">{error}</p> : null}
          </section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

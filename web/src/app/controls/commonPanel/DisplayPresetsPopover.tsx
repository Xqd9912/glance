import { Download, Save, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  createDisplayPreset,
  assertUniqueDisplayPresetNames,
  findDisplayPresetByName,
  loadDisplayPresets,
  overwriteDisplayPreset,
  parseDisplayPresets,
  renameDisplayPreset,
  saveDisplayPresets,
  serializeDisplayPresets,
  type DisplayPreset,
  type DisplayPresetSnapshot,
} from "../../../model";

export function DisplayPresetsPopover({
  getSnapshot,
  onApply,
}: {
  getSnapshot: () => DisplayPresetSnapshot;
  onApply: (snapshot: DisplayPresetSnapshot) => string | null;
}) {
  const initial = useRef(loadDisplayPresets());
  const [presets, setPresets] = useState(initial.current.presets);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(initial.current.error);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const matchingPreset = findDisplayPresetByName(presets, name);

  function replacePresets(next: DisplayPreset[]) {
    try {
      saveDisplayPresets(next);
      setPresets(next);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save presets.");
    }
  }

  function handleSave() {
    try {
      if (matchingPreset) {
        replacePresets(presets.map((preset) => (
          preset.id === matchingPreset.id
            ? overwriteDisplayPreset(preset, getSnapshot())
            : preset
        )));
        setMessage(`Overwrote "${matchingPreset.name}".`);
        setName("");
        return;
      }
      const preset = createDisplayPreset(name, getSnapshot());
      replacePresets([...presets, preset]);
      setName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save preset.");
    }
  }

  function handleExport() {
    const blob = new Blob([serializeDisplayPresets(presets)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "glance-display-presets.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const imported = parseDisplayPresets(await file.text());
      assertUniqueDisplayPresetNames(imported);
      replacePresets(imported);
      setMessage("Presets imported.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not import presets.");
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[10px]">
          <Save aria-hidden="true" className="size-3" /> Presets
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-[330px] p-3">
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            <input
              value={name}
              aria-label="Preset name"
              placeholder="Preset name"
              className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") handleSave(); }}
            />
            <Button type="button" size="sm" onClick={handleSave}>
              {matchingPreset ? "Overwrite" : "Save"}
            </Button>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border px-2">
            {presets.length === 0 ? (
              <p className="py-4 text-center text-[10px] text-muted-foreground">No saved presets.</p>
            ) : presets.map((preset) => (
              <div key={preset.id} className="border-b py-2 last:border-0">
                <div className="truncate text-xs font-medium">{preset.name}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <PresetAction label="Apply" onClick={() => setMessage(onApply(preset.snapshot))} />
                  <PresetAction label="Overwrite" onClick={() => replacePresets(presets.map((item) => item.id === preset.id ? overwriteDisplayPreset(item, getSnapshot()) : item))} />
                  <PresetAction label="Rename" onClick={() => {
                    const nextName = window.prompt("Preset name", preset.name);
                    if (nextName !== null) {
                      try {
                        const duplicate = findDisplayPresetByName(presets, nextName, preset.id);
                        if (duplicate) {
                          throw new Error(`A preset named "${duplicate.name}" already exists.`);
                        }
                        replacePresets(presets.map((item) => item.id === preset.id ? renameDisplayPreset(item, nextName) : item));
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "Could not rename preset.");
                      }
                    }
                  }} />
                  <PresetAction label="Delete" onClick={() => replacePresets(presets.filter((item) => item.id !== preset.id))} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload aria-hidden="true" /> Import
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={presets.length === 0} onClick={handleExport}>
              <Download aria-hidden="true" /> Export
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void handleImport(file);
              }}
            />
          </div>
          {message ? <p role="status" className="text-[10px] text-muted-foreground">{message}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PresetAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="rounded border px-1.5 py-0.5 text-[9px] hover:bg-muted" onClick={onClick}>{label}</button>;
}

import { AlertTriangleIcon, ImageDown, Link, RotateCcw, Unlink } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  createDefaultExportSettings,
  EXPORT_FORMAT_OPTIONS,
  EXPORT_MESH_QUALITY_OPTIONS,
  EXPORT_SUPERSAMPLING_OPTIONS,
  parseExportDimensionInput,
  setExportAspectRatioLocked,
  setExportDimension,
  setExportFormat,
  setExportMeshQuality,
  setExportSupersampling,
  validateExportSettings,
  type ExportFormat,
  type ExportMeshQuality,
  type ExportProjectedSize,
  type ExportSettingsState,
  type ExportSupersampling,
} from "../../../model";
import {
  TOOL_ICON_BUTTON_CLASS,
  TOOL_ICON_BUTTON_RESET_FEEDBACK_A_CLASS,
  TOOL_ICON_BUTTON_RESET_FEEDBACK_B_CLASS,
} from "../../surface";
import { TOOL_ICON_BUTTON_FEEDBACK_ANIMATION_MS } from "./controlFeedback";

const EXPORT_MESH_QUALITY_LABELS: Record<ExportMeshQuality, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
};
const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: "PDF",
  png: "PNG",
};

export function ExportTabContent({
  error,
  exportProjectedSize,
  isExporting,
  onExport,
  onSettingsChange,
  settings,
}: {
  error: string | null;
  exportProjectedSize?: ExportProjectedSize;
  isExporting: boolean;
  onExport: () => void;
  onSettingsChange: (settings: ExportSettingsState) => void;
  settings: ExportSettingsState;
}) {
  const validation = validateExportSettings(settings);
  const statusMessage = error ?? validation.message;
  const actionLabel = `Export ${EXPORT_FORMAT_LABELS[settings.format]}`;

  function setDimension(dimension: "height" | "width", value: number) {
    onSettingsChange(setExportDimension(settings, dimension, value, exportProjectedSize));
  }

  const [resetFeedbackPhase, setResetFeedbackPhase] = useState<"a" | "b" | null>(null);
  const resetFeedbackTickRef = useRef(0);
  const resetFeedbackTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(resetFeedbackTimeoutRef.current);
      }
    },
    [],
  );

  function handleResetQualityClick() {
    const defaultSettings = createDefaultExportSettings();
    onSettingsChange({
      ...settings,
      aspectRatioLocked: defaultSettings.aspectRatioLocked,
      height: defaultSettings.height,
      meshQuality: defaultSettings.meshQuality,
      pixelsPerProjectedUnit: defaultSettings.pixelsPerProjectedUnit,
      supersampling: defaultSettings.supersampling,
      width: defaultSettings.width,
    });

    if (resetFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(resetFeedbackTimeoutRef.current);
    }

    resetFeedbackTickRef.current += 1;
    setResetFeedbackPhase(resetFeedbackTickRef.current % 2 === 0 ? "b" : "a");
    resetFeedbackTimeoutRef.current = window.setTimeout(() => {
      setResetFeedbackPhase(null);
      resetFeedbackTimeoutRef.current = null;
    }, TOOL_ICON_BUTTON_FEEDBACK_ANIMATION_MS);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <section aria-labelledby="export-components-label">
        <h2
          id="export-components-label"
          className="px-1.5 text-xs font-bold leading-tight text-muted-foreground"
        >
          Components
        </h2>
      </section>

      <Separator className="my-0.5" />

      <section aria-labelledby="export-quality-label" className="flex flex-col gap-2.5">
        <div className="grid grid-cols-[minmax(5.5rem,1fr)_6.75rem_2.35rem] items-center gap-2 px-1.5">
          <div className="flex min-w-0 items-center gap-1">
            <h2
              id="export-quality-label"
              className="text-xs font-bold leading-tight text-muted-foreground"
            >
              Quality
            </h2>
            <ExportStatusIndicator message={statusMessage} />
          </div>
          <span aria-hidden="true" />
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Reset quality"
                  className={cn(
                    TOOL_ICON_BUTTON_CLASS,
                    resetFeedbackPhase === "a" ? TOOL_ICON_BUTTON_RESET_FEEDBACK_A_CLASS : null,
                    resetFeedbackPhase === "b" ? TOOL_ICON_BUTTON_RESET_FEEDBACK_B_CLASS : null,
                  )}
                  onClick={handleResetQualityClick}
                >
                  <RotateCcw aria-hidden="true" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">Reset quality</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-end justify-between gap-3 px-1.5">
          <div className="grid grid-cols-[2.75rem_1.25rem_2.75rem] items-end gap-[0.1875rem]">
            <ExportSizeInput
              label="Width"
              accessibleLabel="Export width"
              value={settings.width}
              onCommit={(value) => setDimension("width", value)}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={
                    settings.aspectRatioLocked
                      ? "Unlock aspect ratio"
                      : "Lock aspect ratio"
                  }
                  aria-pressed={settings.aspectRatioLocked}
                  className="mb-0 inline-flex h-6 w-full items-center justify-center rounded-md bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-3.5"
                  onClick={() =>
                    onSettingsChange(
                      setExportAspectRatioLocked(
                        settings,
                        !settings.aspectRatioLocked,
                        exportProjectedSize,
                      ),
                    )}
                >
                  {settings.aspectRatioLocked ? (
                    <Link aria-hidden="true" />
                  ) : (
                    <Unlink aria-hidden="true" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {settings.aspectRatioLocked ? "Unlock ratio" : "Lock ratio"}
              </TooltipContent>
            </Tooltip>

            <ExportSizeInput
              label="Height"
              accessibleLabel="Export height"
              value={settings.height}
              onCommit={(value) => setDimension("height", value)}
            />
          </div>

          <ExportSupersamplingControl
            value={settings.supersampling}
            onCommit={(value) =>
              onSettingsChange(setExportSupersampling(settings, value))
            }
          />
        </div>

        <ExportMeshQualityControl
          value={settings.meshQuality}
          onCommit={(value) =>
            onSettingsChange(setExportMeshQuality(settings, value))
          }
        />
      </section>

      <div className="mb-1.5 flex min-h-8 items-end justify-between gap-2 px-1.5">
        <label className="grid min-w-0 gap-1">
          <span className="truncate px-0.5 text-[0.68rem] font-semibold leading-none text-muted-foreground">
            Format
          </span>
          <Select
            value={settings.format}
            onValueChange={(value) =>
              onSettingsChange(setExportFormat(settings, value as ExportFormat))
            }
          >
            <SelectTrigger
              size="sm"
              aria-label="Format"
              className="!h-6 w-20 !px-2 !py-0 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              position="popper"
              className="!bg-background !text-foreground"
            >
              <SelectGroup>
                {EXPORT_FORMAT_OPTIONS.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    textValue={EXPORT_FORMAT_LABELS[option]}
                    className="min-h-6 py-0.5 text-sm"
                  >
                    {EXPORT_FORMAT_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            aria-label={actionLabel}
            className="h-7 gap-1.5 rounded-full px-2.5 text-xs transition-[background-color,transform] duration-100 ease-out active:translate-y-[0.5px] active:bg-primary/80 [&_svg]:size-3.5"
            disabled={!validation.valid}
            onClick={onExport}
          >
            <span
              aria-hidden="true"
              data-icon="inline-start"
              className="relative inline-flex size-3.5 shrink-0"
            >
              <ImageDown
                className={cn(
                  "absolute inset-0 transition-[opacity,transform] duration-150 ease-out",
                  isExporting ? "scale-90 opacity-0" : "scale-100 opacity-100",
                )}
              />
              <span
                className={cn(
                  "absolute inset-0 rounded-full border-2 border-primary-foreground/35 border-t-primary-foreground transition-opacity duration-150 ease-out motion-safe:animate-spin motion-safe:[animation-duration:450ms]",
                  isExporting ? "opacity-100" : "opacity-0",
                )}
              />
            </span>
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExportStatusIndicator({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          tabIndex={0}
          aria-label={message}
          className="inline-flex size-4 items-center justify-center rounded-md text-amber-600 outline-none focus-visible:ring-[3px] focus-visible:ring-amber-400/40 [&_svg]:size-3.5"
        >
          <AlertTriangleIcon aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-52">
        {message}
      </TooltipContent>
    </Tooltip>
  );
}

function ExportSizeInput({
  accessibleLabel,
  label,
  onCommit,
  value,
}: {
  accessibleLabel: string;
  label: string;
  onCommit: (value: number) => void;
  value: number;
}) {
  const [valueText, setValueText] = useState(String(value));

  useEffect(() => {
    setValueText(String(value));
  }, [value]);

  function commitValueText() {
    const nextValue = parseExportDimensionInput(valueText);
    if (nextValue === null) {
      setValueText(String(value));
      return;
    }

    setValueText(String(nextValue));
    onCommit(nextValue);
  }

  function handleValueKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.currentTarget.blur();
      commitValueText();
      return;
    }

    if (event.key === "Escape") {
      setValueText(String(value));
      event.currentTarget.blur();
    }
  }

  return (
    <label className="grid min-w-0 justify-items-start gap-1">
      <span className="px-0.5 text-[0.68rem] font-semibold leading-none text-muted-foreground">
        {label}
      </span>
      <Input
        type="text"
        inputMode="numeric"
        value={valueText}
        aria-label={accessibleLabel}
        className="h-6 w-11 px-1.5 text-left font-mono text-[0.68rem] tabular-nums focus-visible:border-ring/20 focus-visible:bg-background/80 focus-visible:ring-[1px] focus-visible:ring-ring/20 md:text-[0.68rem]"
        onBlur={commitValueText}
        onChange={(event) => setValueText(event.target.value)}
        onKeyDown={handleValueKeyDown}
      />
    </label>
  );
}

function ExportSupersamplingControl({
  onCommit,
  value,
}: {
  onCommit: (value: number) => void;
  value: ExportSupersampling;
}) {
  return (
    <label className="ml-auto grid min-w-0 justify-items-end gap-1">
      <span className="truncate px-0.5 text-[0.68rem] font-semibold leading-none text-muted-foreground">
        Super Sampling
      </span>
      <Tabs
        value={String(value)}
        className="w-28 gap-0"
        onValueChange={(nextValue) => onCommit(Number(nextValue))}
      >
        <TabsList
          aria-label="Export supersampling"
          className="!h-6 w-full rounded-md p-0.5"
        >
          {EXPORT_SUPERSAMPLING_OPTIONS.map((option) => (
            <TabsTrigger
              key={option}
              value={String(option)}
              aria-label={`${option}x supersampling`}
              className="!h-5 rounded-[4px] px-0.5 py-0 text-[0.68rem] font-medium md:text-[0.68rem]"
            >
              {option}x
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </label>
  );
}

function ExportMeshQualityControl({
  onCommit,
  value,
}: {
  onCommit: (value: ExportMeshQuality) => void;
  value: ExportMeshQuality;
}) {
  return (
    <label className="mt-0.5 grid min-w-0 gap-1 px-1.5">
      <span className="truncate px-0.5 text-[0.68rem] font-semibold leading-none text-muted-foreground">
        3D mesh
      </span>
      <Tabs
        value={value}
        className="w-full gap-0"
        onValueChange={(nextValue) => onCommit(nextValue as ExportMeshQuality)}
      >
        <TabsList
          aria-label="Export mesh quality"
          className="!h-6 w-full rounded-md p-0.5"
        >
          {EXPORT_MESH_QUALITY_OPTIONS.map((option) => (
            <TabsTrigger
              key={option}
              value={option}
              aria-label={`${EXPORT_MESH_QUALITY_LABELS[option]} mesh quality`}
              className="!h-5 rounded-[4px] px-0.5 py-0 text-[0.68rem] font-medium md:text-[0.68rem]"
            >
              {EXPORT_MESH_QUALITY_LABELS[option]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </label>
  );
}

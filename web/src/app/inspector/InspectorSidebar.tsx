import type { ReactNode } from "react";

import { PanelRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import {
  BOND_ALGORITHM_OPTIONS,
  type BondAlgorithm,
} from "../../api/scene";
import {
  TOOL_ICON_BUTTON_ACTIVE_CLASS,
  TOOL_ICON_BUTTON_CLASS,
} from "../surface";
import {
  INTERACTION_MODE_OPTIONS,
  type InteractionMode,
} from "../viewState";

const INSPECTOR_BODY_TEXT_CLASS = "text-sm";
const INSPECTOR_SELECT_TRIGGER_CLASS =
  "!h-[26px] w-full !px-2 !py-0 bg-background text-sm";
const INSPECTOR_SELECT_ITEM_CLASS = "min-h-[26px] py-1 text-sm";

export function InspectorToggle({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const label = "Sidebar";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-controls="inspector-sidebar"
            aria-expanded={isOpen}
            aria-label={label}
            className={cn(
              TOOL_ICON_BUTTON_CLASS,
              "absolute right-4 top-4 z-30 size-8 rounded-[10px] [&_svg]:size-4",
              isOpen
                ? TOOL_ICON_BUTTON_ACTIVE_CLASS
                : "border-foreground/10 bg-card/80 backdrop-blur-xl backdrop-saturate-150",
            )}
            onClick={() => onOpenChange(!isOpen)}
          >
            <PanelRight aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function InspectorSidebar({
  bondAlgorithm,
  interactionMode,
  isOpen,
  isSceneLoading,
  showFpsOverlay,
  onBondAlgorithmChange,
  onInteractionModeChange,
  onShowFpsOverlayChange,
}: {
  bondAlgorithm: BondAlgorithm;
  interactionMode: InteractionMode;
  isOpen: boolean;
  isSceneLoading: boolean;
  showFpsOverlay: boolean;
  onBondAlgorithmChange: (bondAlgorithm: BondAlgorithm) => void;
  onInteractionModeChange: (interactionMode: InteractionMode) => void;
  onShowFpsOverlayChange: (showFpsOverlay: boolean) => void;
}) {
  return (
    <aside
      id="inspector-sidebar"
      aria-label="Sidebar"
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={cn(
        "absolute inset-y-0 right-0 z-20 flex w-[340px] max-w-[calc(100vw-1rem)] flex-col border-l border-border bg-[#fdfdfd] text-foreground",
        "transition-transform duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
    >
      <Tabs
        defaultValue="settings"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <header className="flex h-16 shrink-0 items-start px-4 pt-4 pr-16">
          <TabsList
            variant="line"
            className="h-8 w-full justify-start rounded-none p-0"
          >
            <TabsTrigger
              value="settings"
              className="h-8 flex-none px-0 text-[0.875rem] font-semibold after:bottom-[-2px]"
            >
              Advanced
            </TabsTrigger>
          </TabsList>
        </header>

        <div
          data-slot="inspector-body"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          <TabsContent value="settings" className="m-0">
            <SettingsPanel
              bondAlgorithm={bondAlgorithm}
              interactionMode={interactionMode}
              isSceneLoading={isSceneLoading}
              showFpsOverlay={showFpsOverlay}
              onBondAlgorithmChange={onBondAlgorithmChange}
              onInteractionModeChange={onInteractionModeChange}
              onShowFpsOverlayChange={onShowFpsOverlayChange}
            />
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}

function SettingsPanel({
  bondAlgorithm,
  interactionMode,
  isSceneLoading,
  showFpsOverlay,
  onBondAlgorithmChange,
  onInteractionModeChange,
  onShowFpsOverlayChange,
}: {
  bondAlgorithm: BondAlgorithm;
  interactionMode: InteractionMode;
  isSceneLoading: boolean;
  showFpsOverlay: boolean;
  onBondAlgorithmChange: (bondAlgorithm: BondAlgorithm) => void;
  onInteractionModeChange: (interactionMode: InteractionMode) => void;
  onShowFpsOverlayChange: (showFpsOverlay: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <InspectorSwitchRow
        checked={showFpsOverlay}
        label="Show FPS"
        onCheckedChange={onShowFpsOverlayChange}
      />

      <InspectorSelectRow label="Mouse control">
        <Select
          value={interactionMode}
          onValueChange={(value) => onInteractionModeChange(value as InteractionMode)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Mouse control"
            className={INSPECTOR_SELECT_TRIGGER_CLASS}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="!bg-background !text-foreground">
            <SelectGroup>
              {INTERACTION_MODE_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className={INSPECTOR_SELECT_ITEM_CLASS}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </InspectorSelectRow>

      <InspectorSelectRow label="Bonding algorithm">
        <Select
          value={bondAlgorithm}
          disabled={isSceneLoading}
          onValueChange={(value) => onBondAlgorithmChange(value as BondAlgorithm)}
        >
          <SelectTrigger
            size="sm"
            aria-label="Bonding algorithm"
            className={INSPECTOR_SELECT_TRIGGER_CLASS}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="!bg-background !text-foreground">
            <SelectGroup>
              {BOND_ALGORITHM_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className={INSPECTOR_SELECT_ITEM_CLASS}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </InspectorSelectRow>
    </div>
  );
}

function InspectorSwitchRow({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-8 items-center justify-between gap-2",
        INSPECTOR_BODY_TEXT_CLASS,
      )}
    >
      <span className="leading-tight text-foreground">{label}</span>
      <Switch
        checked={checked}
        aria-label={label}
        className="h-4 w-7 p-0.5"
        thumbClassName="size-3 data-[state=checked]:translate-x-3"
        onCheckedChange={onCheckedChange}
      />
    </label>
  );
}

function InspectorSelectRow({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-8 grid-cols-[minmax(0,1fr)_9.5rem] items-center gap-2",
        INSPECTOR_BODY_TEXT_CLASS,
      )}
    >
      <span className="leading-tight text-foreground">{label}</span>
      {children}
    </div>
  );
}

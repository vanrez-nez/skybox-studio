import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { Blend, CircleDot, Ellipsis, Eye, EyeOff, Focus, Lock, LockOpen, Trash2 } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/primitives/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/primitives/dropdown-menu";
import { Button } from "@/components/ui/primitives/button";
import { Input } from "@/components/ui/primitives/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { SliderInput } from "@/components/ui/composables/slider-input";
import { Widget } from "../panels/Widget";
import { BLEND_MODE_GROUPS } from "@/effects/blend-modes";
import {
  getEffectLayerAddon,
  getEffectLayerAddons,
  getEffectLayerFocusTarget,
  type EffectLayer,
  type EffectLayerBlendMode,
} from "@/effects/effect-layer";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/app";

const LAYER_DRAG_TYPE = "effect-layer";

function getLayerIcon(layer: EffectLayer) {
  return getEffectLayerAddon(layer.type).Icon ?? CircleDot;
}

function isLayerDragData(data: Record<string, unknown>): data is {
  index: number;
  layerId: string;
  type: typeof LAYER_DRAG_TYPE;
} {
  return (
    data.type === LAYER_DRAG_TYPE &&
    typeof data.layerId === "string" &&
    typeof data.index === "number"
  );
}

type LayerRowProps = {
  canDeleteLayer: boolean;
  editingLayerId: string | null;
  editingName: string;
  index: number;
  isSelected: boolean;
  layer: EffectLayer;
  onCancelRename: () => void;
  onCommitRename: () => void;
  onDelete: (id: string) => void;
  onEditingNameChange: (name: string) => void;
  onRenameFromMenu: (layer: EffectLayer) => void;
  onSelect: (id: string) => void;
  onSetLocked: (id: string, locked: boolean) => void;
  onStartRename: (layer: EffectLayer) => void;
  onToggleEnabled: (id: string) => void;
};

function LayerRow({
  canDeleteLayer,
  editingLayerId,
  editingName,
  index,
  isSelected,
  layer,
  onCancelRename,
  onCommitRename,
  onDelete,
  onEditingNameChange,
  onRenameFromMenu,
  onSelect,
  onSetLocked,
  onStartRename,
  onToggleEnabled,
}: LayerRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const editingInputRef = useRef<HTMLInputElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const LayerIcon = getLayerIcon(layer);
  const isEditing = layer.id === editingLayerId;

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const focusInput = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        editingInputRef.current?.focus();
        editingInputRef.current?.select();
      });
    }, 50);

    return () => {
      window.clearTimeout(focusInput);
    };
  }, [isEditing]);

  useEffect(() => {
    const row = rowRef.current;

    if (!row) {
      return;
    }

    return combine(
      draggable({
        element: row,
        getInitialData: () => ({
          index,
          layerId: layer.id,
          type: LAYER_DRAG_TYPE,
        }),
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        canDrop: ({ source }) =>
          isLayerDragData(source.data) && source.data.layerId !== layer.id,
        element: row,
        getData: ({ element, input }) =>
          attachClosestEdge(
            {
              index,
              layerId: layer.id,
              type: LAYER_DRAG_TYPE,
            },
            {
              allowedEdges: ["top", "bottom"],
              element,
              input,
            }
          ),
        getIsSticky: () => true,
        onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragEnter: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      })
    );
  }, [index, layer.id]);

  const handleRowKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(layer.id);
    }
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommitRename();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancelRename();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={rowRef}
          aria-label={`${layer.name} layer`}
          aria-selected={isSelected}
          className={cn(
            "relative flex h-8 cursor-grab items-center gap-2 rounded-md px-2 text-xs outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing [&_svg:not([class*='size-'])]:size-3",
            isSelected
              ? "bg-accent text-accent-foreground"
              : "hover:bg-accent hover:text-accent-foreground",
            !layer.enabled && "opacity-60",
            isDragging && "opacity-50"
          )}
          data-layer-row-id={layer.id}
          onClick={() => onSelect(layer.id)}
          onDoubleClick={() => onStartRename(layer)}
          onKeyDown={handleRowKeyDown}
          role="option"
          tabIndex={0}
        >
          {closestEdge ? (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute right-2 left-2 flex items-center",
                closestEdge === "top" ? "top-0" : "bottom-0"
              )}
            >
              <span className="size-1.5 rounded-full bg-ring" />
              <span className="h-0.5 flex-1 bg-ring" />
              <span className="size-1.5 rounded-full bg-ring" />
            </span>
          ) : null}
          <LayerIcon />
          {isEditing ? (
            <Input
              ref={editingInputRef}
              aria-label="Layer name"
              className="h-6 min-w-0 flex-1 bg-background text-xs"
              data-layer-rename-input={layer.id}
              onChange={(event) => onEditingNameChange(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onKeyDown={handleRenameKeyDown}
              value={editingName}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">{layer.name}</span>
          )}
          {layer.locked ? (
            <Button
              aria-label="Unlock layer"
              onClick={(event) => {
                event.stopPropagation();
                onSetLocked(layer.id, false);
              }}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <Lock />
            </Button>
          ) : null}
          <Button
            aria-label={layer.enabled ? "Disable layer" : "Enable layer"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleEnabled(layer.id);
            }}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            {layer.enabled ? <Eye /> : <EyeOff />}
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => onRenameFromMenu(layer)}
          onSelect={() => onRenameFromMenu(layer)}
        >
          Rename
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onToggleEnabled(layer.id)}>
          {layer.enabled ? "Disable" : "Enable"}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onSetLocked(layer.id, !layer.locked)}>
          {layer.locked ? "Unlock" : "Lock"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!canDeleteLayer}
          onSelect={() => onDelete(layer.id)}
          variant="destructive"
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function LayersWidget() {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isBlendSelectOpen, setIsBlendSelectOpen] = useState(false);
  const addEffectLayer = useWorkspaceStore((state) => state.addEffectLayer);
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const clearPreviewEffectLayerBlendMode = useWorkspaceStore(
    (state) => state.clearPreviewEffectLayerBlendMode
  );
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const deleteEffectLayer = useWorkspaceStore((state) => state.deleteEffectLayer);
  const deleteSelectedEffectLayer = useWorkspaceStore((state) => state.deleteSelectedEffectLayer);
  const emitLayerFocusRequest = useWorkspaceStore((state) => state.emitLayerFocusRequest);
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const reorderEffectLayer = useWorkspaceStore((state) => state.reorderEffectLayer);
  const renameEffectLayer = useWorkspaceStore((state) => state.renameEffectLayer);
  const selectEffectLayer = useWorkspaceStore((state) => state.selectEffectLayer);
  const selectedLayerId = useWorkspaceStore((state) => state.selectedLayerId);
  const setEffectLayerBlendMode = useWorkspaceStore((state) => state.setEffectLayerBlendMode);
  const setEffectLayerOpacity = useWorkspaceStore((state) => state.setEffectLayerOpacity);
  const setPreviewEffectLayerBlendMode = useWorkspaceStore(
    (state) => state.setPreviewEffectLayerBlendMode
  );
  const setEffectLayerLocked = useWorkspaceStore((state) => state.setEffectLayerLocked);
  const toggleEffectLayerEnabled = useWorkspaceStore((state) => state.toggleEffectLayerEnabled);
  const canDeleteLayer = effectLayers.length > 0 && Boolean(selectedLayerId);
  const selectedLayer = effectLayers.find((layer) => layer.id === selectedLayerId);
  const selectedLayerFocusTarget = getEffectLayerFocusTarget(selectedLayer);

  useEffect(() => {
    if (!editingLayerId) {
      return;
    }

    const cancelOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        cancelRename();
        return;
      }

      const targetLayerRow = target.closest("[data-layer-row-id]");

      if (targetLayerRow?.getAttribute("data-layer-row-id") !== editingLayerId) {
        cancelRename();
      }
    };
    document.addEventListener("pointerdown", cancelOnOutsidePointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", cancelOnOutsidePointerDown, true);
    };
  }, [editingLayerId]);

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isLayerDragData(source.data),
        onDrop: ({ location, source }) => {
          const target = location.current.dropTargets[0];

          if (!target || !isLayerDragData(source.data) || !isLayerDragData(target.data)) {
            return;
          }

          reorderEffectLayer(
            source.data.layerId,
            target.data.layerId,
            extractClosestEdge(target.data)
          );
        },
      }),
    [reorderEffectLayer]
  );

  useEffect(() => {
    clearPreviewEffectLayerBlendMode();
  }, [clearPreviewEffectLayerBlendMode, selectedLayerId]);

  const startRenamingLayer = (layer: EffectLayer) => {
    selectEffectLayer(layer.id);
    setEditingLayerId(layer.id);
    setEditingName(layer.name);
  };

  const startRenamingLayerFromMenu = (layer: EffectLayer) => {
    window.setTimeout(() => {
      startRenamingLayer(layer);
    }, 0);
  };

  const commitRename = () => {
    if (!editingLayerId) {
      return;
    }

    renameEffectLayer(editingLayerId, editingName);
    setEditingLayerId(null);
  };

  const cancelRename = () => {
    setEditingLayerId(null);
  };

  const previewBlendMode = (blendMode: EffectLayerBlendMode) => {
    if (!selectedLayer?.id) {
      clearPreviewEffectLayerBlendMode();
      return;
    }

    setPreviewEffectLayerBlendMode(selectedLayer.id, blendMode);
  };

  return (
    <Widget title="Layers" contentClassName="flex min-h-32 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md [&_svg:not([class*='size-'])]:size-4"
          >
            <Blend />
          </span>
          <Select
            disabled={!selectedLayer}
            onOpenChange={(isOpen) => {
              setIsBlendSelectOpen(isOpen);

              if (!isOpen) {
                clearPreviewEffectLayerBlendMode();
              }
            }}
            onValueChange={(value) => {
              clearPreviewEffectLayerBlendMode();

              if (selectedLayer?.id) {
                setEffectLayerBlendMode(selectedLayer.id, value as EffectLayerBlendMode);
              }
            }}
            open={isBlendSelectOpen}
            value={selectedLayer?.blendMode ?? "normal"}
          >
            <SelectTrigger
              aria-label="Layer blend mode"
              className="w-28 bg-background text-xs"
              size="xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent onPointerLeave={clearPreviewEffectLayerBlendMode}>
              {BLEND_MODE_GROUPS.map((group, groupIndex) => (
                <SelectGroup key={group.label}>
                  {groupIndex > 0 ? <SelectSeparator /> : null}
                  {group.modes.map((option) => (
                    <SelectItem
                      className="text-xs"
                      key={option.value}
                      onFocus={() => previewBlendMode(option.value)}
                      onPointerMove={() => previewBlendMode(option.value)}
                      value={option.value}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <div className="flex shrink-0 items-center">
            <SliderInput
              ariaLabel="Layer opacity value"
              disabled={!selectedLayer}
              onInteractionEnd={commitHistoryTransaction}
              onInteractionStart={beginHistoryTransaction}
              onValueChange={(value, options) =>
                selectedLayer?.id && setEffectLayerOpacity(selectedLayer.id, value, options)
              }
              sliderAriaLabel="Layer opacity slider"
              value={selectedLayer?.opacity ?? 100}
            />
          </div>
        </div>
        <Button
          aria-label={selectedLayer?.locked ? "Unlock selected layer" : "Lock selected layer"}
          disabled={!selectedLayer}
          onClick={() => {
            if (selectedLayer) {
              setEffectLayerLocked(selectedLayer.id, !selectedLayer.locked);
            }
          }}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          {selectedLayer?.locked ? <Lock /> : <LockOpen />}
        </Button>
      </div>

      <div aria-label="Effect layers" className="flex flex-col gap-1" role="listbox">
        {effectLayers.length === 0 ? (
          <div className="flex h-16 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            Empty layers
          </div>
        ) : null}
        {effectLayers.map((layer, index) => (
          <LayerRow
            canDeleteLayer={canDeleteLayer}
            editingLayerId={editingLayerId}
            editingName={editingName}
            index={index}
            isSelected={layer.id === selectedLayerId}
            key={layer.id}
            layer={layer}
            onCancelRename={cancelRename}
            onCommitRename={commitRename}
            onDelete={deleteEffectLayer}
            onEditingNameChange={setEditingName}
            onRenameFromMenu={startRenamingLayerFromMenu}
            onSelect={selectEffectLayer}
            onSetLocked={setEffectLayerLocked}
            onStartRename={startRenamingLayer}
            onToggleEnabled={toggleEffectLayerEnabled}
          />
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-1 border-t pt-2">
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Add layer"
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                {getEffectLayerAddons().map((addon) => {
                  const AddonIcon = addon.Icon ?? CircleDot;

                  return (
                    <DropdownMenuItem
                      key={addon.type}
                      onSelect={() =>
                        addEffectLayer(
                          addon.type,
                          addon.type === "spot" || addon.type === "moon" || addon.type === "sun"
                            ? { centerDirection: useWorkspaceStore.getState().sceneLookDirection }
                            : undefined
                        )
                      }
                    >
                      <AddonIcon />
                      {addon.displayName}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            aria-label="Focus selected layer"
            disabled={!selectedLayer || !selectedLayerFocusTarget}
            onClick={() => {
              if (selectedLayer?.id && selectedLayerFocusTarget) {
                emitLayerFocusRequest(selectedLayer.id);
              }
            }}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Focus />
          </Button>
        </div>
        <Button
          aria-label="Delete selected layer"
          className="hover:bg-card! hover:text-destructive"
          disabled={!canDeleteLayer}
          onClick={deleteSelectedEffectLayer}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          <Trash2 />
        </Button>
      </div>
    </Widget>
  );
}

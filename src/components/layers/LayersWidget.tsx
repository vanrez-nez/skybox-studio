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
import { Eye, EyeOff, Palette, Sparkles, Trash2 } from "lucide-react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Widget } from "@/components/widgets/Widget";
import type { EffectLayer, EffectLayerType } from "@/effects/effect-layer";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/workspace-store";

const LAYER_DRAG_TYPE = "effect-layer";

function getLayerIcon(type: EffectLayerType) {
  return type === "gradient" ? Palette : Sparkles;
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
  onStartRename,
  onToggleEnabled,
}: LayerRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const editingInputRef = useRef<HTMLInputElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const LayerIcon = getLayerIcon(layer.type);
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
  const addEffectLayer = useWorkspaceStore((state) => state.addEffectLayer);
  const deleteEffectLayer = useWorkspaceStore((state) => state.deleteEffectLayer);
  const deleteSelectedEffectLayer = useWorkspaceStore((state) => state.deleteSelectedEffectLayer);
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const reorderEffectLayer = useWorkspaceStore((state) => state.reorderEffectLayer);
  const renameEffectLayer = useWorkspaceStore((state) => state.renameEffectLayer);
  const selectEffectLayer = useWorkspaceStore((state) => state.selectEffectLayer);
  const selectedLayerId = useWorkspaceStore((state) => state.selectedLayerId);
  const toggleEffectLayerEnabled = useWorkspaceStore((state) => state.toggleEffectLayerEnabled);
  const canDeleteLayer = effectLayers.length > 0 && Boolean(selectedLayerId);

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

  return (
    <Widget title="Layers" contentClassName="flex min-h-32 flex-col gap-2">
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
            onStartRename={startRenamingLayer}
            onToggleEnabled={toggleEffectLayerEnabled}
          />
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-1 border-t pt-2">
        <div className="flex items-center gap-1">
          <Button
            aria-label="Add gradient layer"
            onClick={() => addEffectLayer("gradient")}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Palette />
          </Button>
          <Button
            aria-label="Add field gradient layer"
            onClick={() => addEffectLayer("field-gradient")}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Sparkles />
          </Button>
        </div>
        <Button
          aria-label="Delete selected layer"
          disabled={!canDeleteLayer}
          onClick={deleteSelectedEffectLayer}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Trash2 />
        </Button>
      </div>
    </Widget>
  );
}

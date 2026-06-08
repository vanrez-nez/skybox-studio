import { Fragment, useEffect, useRef } from "react";
import { HotkeyManager } from "@tanstack/hotkeys";
import type { RegisterableHotkey } from "@tanstack/hotkeys";

import { Kbd, KbdGroup } from "@/components/ui/primitives/kbd";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/primitives/menubar";
import { useWorkspaceStore } from "@/store/app";
import {
  type CameraRotationMode,
  type MenuCommandId,
  type MenuId,
  type SceneRenderMode,
  type SkyGeometryType,
} from "@/store/modules/scene";
import { getEffectLayerFocusTarget } from "@/effects/effect-layer";
import { getEffectLayerInterface } from "@/effects/effect-layer-interfaces";

type AppMenuItem = {
  disabled?: boolean;
  id: MenuCommandId;
  label: string;
  separatorBefore?: boolean;
  shortcut?: string[];
};

const fileExportItems: AppMenuItem[] = [
  { id: "file.export.image", label: "Image" },
  { id: "file.export.runtime", label: "Runtime" },
];
const fileLoadItems: AppMenuItem[] = [{ id: "file.load", label: "Load" }];
const LAYER_TRANSFORM_KEYBOARD_SCOPE = "layer-transform-keyboard";
const LAYER_TRANSFORM_KEYBOARD_COMMIT_DELAY_MS = 300;
const LAYER_POSITION_DIRECTIONS = [
  { delta: { x: -1, y: 0 }, key: "ArrowLeft" },
  { delta: { x: 1, y: 0 }, key: "ArrowRight" },
  { delta: { x: 0, y: 1 }, key: "ArrowUp" },
  { delta: { x: 0, y: -1 }, key: "ArrowDown" },
] as const;
const LAYER_POSITION_MODIFIERS = [
  {},
  { shift: true },
  { alt: true },
  { alt: true, shift: true },
] as const;
const LAYER_POSITION_HOTKEYS = LAYER_POSITION_MODIFIERS.flatMap((modifier) =>
  LAYER_POSITION_DIRECTIONS.map((direction) => ({
    delta: direction.delta,
    hotkey: { key: direction.key, ...modifier } satisfies RegisterableHotkey,
  }))
);

const menuItems: Array<{
  id: MenuId;
  label: string;
  items?: AppMenuItem[];
}> = [
  {
    id: "file",
    label: "File",
  },
  { id: "edit", label: "Edit" },
  { id: "layer", label: "Layer" },
  { id: "view", label: "View" },
  { id: "sky", label: "Sky" },
];

function isMacPlatform() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /Mac|iPhone|iPad/.test(navigator.platform);
}

function getModifierKeyLabel() {
  return isMacPlatform() ? "⌘" : "Ctrl";
}

function getDeleteShortcutKey() {
  return isMacPlatform() ? "Backspace" : "Delete";
}

function getDeleteShortcutLabel() {
  return isMacPlatform() ? "⌫" : "Delete";
}

function getLayerPositionNudgeStep(event: KeyboardEvent) {
  if (event.altKey) {
    return 0.1;
  }

  return event.shiftKey ? 10 : 1;
}

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <KbdGroup className="ml-auto pl-8">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
    </KbdGroup>
  );
}

export function AppMenu() {
  const emitMenuEvent = useWorkspaceStore((state) => state.emitMenuEvent);
  const undoHistory = useWorkspaceStore((state) => state.undoHistory);
  const redoHistory = useWorkspaceStore((state) => state.redoHistory);
  const canUndo = useWorkspaceStore((state) => state.historyPast.length > 0);
  const canRedo = useWorkspaceStore((state) => state.historyFuture.length > 0);
  const cameraRotationMode = useWorkspaceStore((state) => state.cameraRotationMode);
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const selectedLayerId = useWorkspaceStore((state) => state.selectedLayerId);
  const sceneRenderMode = useWorkspaceStore((state) => state.sceneRenderMode);
  const skyGeometryType = useWorkspaceStore((state) => state.skyGeometryType);
  const showGroundPlaneHelper = useWorkspaceStore((state) => state.showGroundPlaneHelper);
  const showOrientationGizmo = useWorkspaceStore((state) => state.showOrientationGizmo);
  const showSkyGeometry = useWorkspaceStore((state) => state.showSkyGeometry);
  const setSceneRenderMode = useWorkspaceStore((state) => state.setSceneRenderMode);
  const setCameraRotationMode = useWorkspaceStore((state) => state.setCameraRotationMode);
  const setSkyGeometryType = useWorkspaceStore((state) => state.setSkyGeometryType);
  const setShowGroundPlaneHelper = useWorkspaceStore((state) => state.setShowGroundPlaneHelper);
  const setShowOrientationGizmo = useWorkspaceStore((state) => state.setShowOrientationGizmo);
  const setShowSkyGeometry = useWorkspaceStore((state) => state.setShowSkyGeometry);
  const deleteSelectedEffectLayer = useWorkspaceStore((state) => state.deleteSelectedEffectLayer);
  const emitLayerFocusRequest = useWorkspaceStore((state) => state.emitLayerFocusRequest);
  const applyEffectLayerModifier = useWorkspaceStore((state) => state.applyEffectLayerModifier);
  const beginHistoryTransaction = useWorkspaceStore((state) => state.beginHistoryTransaction);
  const commitHistoryTransaction = useWorkspaceStore((state) => state.commitHistoryTransaction);
  const setEffectLayerLocked = useWorkspaceStore((state) => state.setEffectLayerLocked);
  const toggleEffectLayerEnabled = useWorkspaceStore((state) => state.toggleEffectLayerEnabled);
  const applyEffectLayerModifierRef = useRef(applyEffectLayerModifier);
  const beginHistoryTransactionRef = useRef(beginHistoryTransaction);
  const commitHistoryTransactionRef = useRef(commitHistoryTransaction);
  const undoRef = useRef(undoHistory);
  const redoRef = useRef(redoHistory);
  const deleteSelectedEffectLayerRef = useRef(deleteSelectedEffectLayer);
  const emitLayerFocusRequestRef = useRef(emitLayerFocusRequest);
  const layerTransformKeyboardActiveRef = useRef(false);
  const layerTransformKeyboardTimerRef = useRef<number | null>(null);
  const selectedLayerIdRef = useRef(selectedLayerId);
  const toggleEffectLayerEnabledRef = useRef(toggleEffectLayerEnabled);
  const modifierKeyLabel = getModifierKeyLabel();
  const deleteShortcutKey = getDeleteShortcutKey();
  const deleteShortcutLabel = getDeleteShortcutLabel();
  const selectedLayer = effectLayers.find((layer) => layer.id === selectedLayerId);
  const hasSelectedLayer = Boolean(selectedLayer);
  const canFocusSelectedLayer = Boolean(getEffectLayerFocusTarget(selectedLayer));
  const isSelectedLayerLocked = Boolean(selectedLayer?.locked);
  const editMenuItems: AppMenuItem[] = [
    {
      disabled: !canUndo,
      id: "edit.undo",
      label: "Undo",
      shortcut: [modifierKeyLabel, "Z"],
    },
    {
      disabled: !canRedo,
      id: "edit.redo",
      label: "Redo",
      shortcut: [modifierKeyLabel, "⇧", "Z"],
    },
  ];
  const layerMenuItems: AppMenuItem[] = [
    {
      disabled: !canFocusSelectedLayer,
      id: "layer.focus",
      label: "Focus",
      shortcut: [modifierKeyLabel, "F"],
    },
    {
      disabled: !hasSelectedLayer,
      id: "layer.toggle-visibility",
      label: "Toggle Visibility",
      shortcut: [modifierKeyLabel, "H"],
    },
    {
      disabled: !hasSelectedLayer,
      id: "layer.delete",
      label: "Delete",
      shortcut: [deleteShortcutLabel],
    },
    {
      disabled: !hasSelectedLayer || isSelectedLayerLocked,
      id: "layer.lock",
      label: "Lock",
      separatorBefore: true,
    },
    {
      disabled: !hasSelectedLayer || !isSelectedLayerLocked,
      id: "layer.unlock",
      label: "Unlock",
    },
  ];

  useEffect(() => {
    undoRef.current = undoHistory;
  }, [undoHistory]);

  useEffect(() => {
    redoRef.current = redoHistory;
  }, [redoHistory]);

  useEffect(() => {
    deleteSelectedEffectLayerRef.current = deleteSelectedEffectLayer;
  }, [deleteSelectedEffectLayer]);

  useEffect(() => {
    applyEffectLayerModifierRef.current = applyEffectLayerModifier;
  }, [applyEffectLayerModifier]);

  useEffect(() => {
    beginHistoryTransactionRef.current = beginHistoryTransaction;
  }, [beginHistoryTransaction]);

  useEffect(() => {
    commitHistoryTransactionRef.current = commitHistoryTransaction;
  }, [commitHistoryTransaction]);

  useEffect(() => {
    emitLayerFocusRequestRef.current = emitLayerFocusRequest;
  }, [emitLayerFocusRequest]);

  useEffect(() => {
    selectedLayerIdRef.current = selectedLayerId;
  }, [selectedLayerId]);

  useEffect(() => {
    toggleEffectLayerEnabledRef.current = toggleEffectLayerEnabled;
  }, [toggleEffectLayerEnabled]);

  useEffect(() => {
    const hotkeys = HotkeyManager.getInstance();
    const commitKeyboardTransform = () => {
      if (layerTransformKeyboardTimerRef.current !== null) {
        window.clearTimeout(layerTransformKeyboardTimerRef.current);
        layerTransformKeyboardTimerRef.current = null;
      }

      if (!layerTransformKeyboardActiveRef.current) {
        return;
      }

      layerTransformKeyboardActiveRef.current = false;
      commitHistoryTransactionRef.current(LAYER_TRANSFORM_KEYBOARD_SCOPE);
    };
    const scheduleKeyboardTransformCommit = () => {
      if (layerTransformKeyboardTimerRef.current !== null) {
        window.clearTimeout(layerTransformKeyboardTimerRef.current);
      }

      layerTransformKeyboardTimerRef.current = window.setTimeout(
        commitKeyboardTransform,
        LAYER_TRANSFORM_KEYBOARD_COMMIT_DELAY_MS
      );
    };
    const nudgeSelectedLayerPosition = (
      event: KeyboardEvent,
      direction: { x: number; y: number }
    ) => {
      const state = useWorkspaceStore.getState();
      const selectedLayer = state.effectLayers.find(
        (effectLayer) => effectLayer.id === state.selectedLayerId
      );

      if (
        !selectedLayer ||
        selectedLayer.locked ||
        !getEffectLayerInterface(selectedLayer, "2d-position")
      ) {
        return;
      }

      const step = getLayerPositionNudgeStep(event);

      if (!layerTransformKeyboardActiveRef.current) {
        layerTransformKeyboardActiveRef.current = true;
        beginHistoryTransactionRef.current(LAYER_TRANSFORM_KEYBOARD_SCOPE);
      }

      applyEffectLayerModifierRef.current(
        selectedLayer.id,
        {
          delta: {
            x: direction.x * step,
            y: direction.y * step,
          },
          interface: "2d-position",
          operation: "translate",
        },
        { history: "skip" }
      );
      scheduleKeyboardTransformCommit();
    };
    const undoHandle = hotkeys.register(
      "Mod+Z",
      () => {
        undoRef.current();
      },
      {
        ignoreInputs: true,
        meta: { name: "Undo" },
        preventDefault: true,
        stopPropagation: true,
      }
    );
    const redoHandle = hotkeys.register(
      "Mod+Shift+Z",
      () => {
        redoRef.current();
      },
      {
        ignoreInputs: true,
        meta: { name: "Redo" },
        preventDefault: true,
        stopPropagation: true,
      }
    );
    const toggleVisibilityHandle = hotkeys.register(
      "Mod+H",
      () => {
        const layerId = selectedLayerIdRef.current;

        if (layerId) {
          toggleEffectLayerEnabledRef.current(layerId);
        }
      },
      {
        ignoreInputs: true,
        meta: { name: "Toggle Layer Visibility" },
        preventDefault: true,
        stopPropagation: true,
      }
    );
    const focusLayerHandle = hotkeys.register(
      "Mod+F",
      () => {
        const state = useWorkspaceStore.getState();
        const layer = state.effectLayers.find(
          (effectLayer) => effectLayer.id === state.selectedLayerId
        );

        if (layer && getEffectLayerFocusTarget(layer)) {
          emitLayerFocusRequestRef.current(layer.id);
        }
      },
      {
        ignoreInputs: true,
        meta: { name: "Focus Layer" },
        preventDefault: true,
        stopPropagation: true,
      }
    );
    const deleteHandle = hotkeys.register(
      deleteShortcutKey,
      () => {
        if (selectedLayerIdRef.current) {
          deleteSelectedEffectLayerRef.current();
        }
      },
      {
        ignoreInputs: true,
        meta: { name: "Delete Layer" },
        preventDefault: true,
        stopPropagation: true,
      }
    );
    const layerPositionHandles = LAYER_POSITION_HOTKEYS.map((positionHotkey) =>
      hotkeys.register(
        positionHotkey.hotkey,
        (event) => nudgeSelectedLayerPosition(event, positionHotkey.delta),
        {
          ignoreInputs: true,
          meta: { name: "Nudge Layer Position" },
          preventDefault: true,
          stopPropagation: true,
        }
      )
    );

    return () => {
      undoHandle.unregister();
      redoHandle.unregister();
      toggleVisibilityHandle.unregister();
      focusLayerHandle.unregister();
      deleteHandle.unregister();
      layerPositionHandles.forEach((handle) => handle.unregister());
      commitKeyboardTransform();
    };
  }, [deleteShortcutKey]);

  function handleMenuCommand(id: MenuCommandId) {
    if (id === "edit.undo") {
      undoHistory();
      return;
    }

    if (id === "edit.redo") {
      redoHistory();
      return;
    }

    if (id === "layer.toggle-visibility") {
      if (selectedLayerId) {
        toggleEffectLayerEnabled(selectedLayerId);
      }
      return;
    }

    if (id === "layer.lock") {
      if (selectedLayerId) {
        setEffectLayerLocked(selectedLayerId, true);
      }
      return;
    }

    if (id === "layer.unlock") {
      if (selectedLayerId) {
        setEffectLayerLocked(selectedLayerId, false);
      }
      return;
    }

    if (id === "layer.focus") {
      if (selectedLayerId && canFocusSelectedLayer) {
        emitLayerFocusRequest(selectedLayerId);
      }
      return;
    }

    if (id === "layer.delete") {
      deleteSelectedEffectLayer();
      return;
    }

    emitMenuEvent(id);
  }

  function renderCommandMenu(items: AppMenuItem[]) {
    return (
      <MenubarContent>
        {items.map((menuItem) => (
          <Fragment key={menuItem.id}>
            {menuItem.separatorBefore ? <MenubarSeparator /> : null}
            <MenubarItem
              disabled={menuItem.disabled}
              onSelect={() => handleMenuCommand(menuItem.id)}
            >
              <span>{menuItem.label}</span>
              {menuItem.shortcut ? <Shortcut keys={menuItem.shortcut} /> : null}
            </MenubarItem>
          </Fragment>
        ))}
      </MenubarContent>
    );
  }

  function renderFileMenu() {
    return (
      <MenubarContent>
        <MenubarSub>
          <MenubarSubTrigger>Export</MenubarSubTrigger>
          <MenubarSubContent>
            {fileExportItems.map((menuItem) => (
              <MenubarItem
                key={menuItem.id}
                disabled={menuItem.disabled}
                onSelect={() => handleMenuCommand(menuItem.id)}
              >
                <span>{menuItem.label}</span>
              </MenubarItem>
            ))}
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSeparator />
        {fileLoadItems.map((menuItem) => (
          <MenubarItem
            key={menuItem.id}
            disabled={menuItem.disabled}
            onSelect={() => handleMenuCommand(menuItem.id)}
          >
            <span>{menuItem.label}</span>
          </MenubarItem>
        ))}
      </MenubarContent>
    );
  }

  function renderViewMenu() {
    return (
      <MenubarContent>
        <MenubarSub>
          <MenubarSubTrigger>Helpers</MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarCheckboxItem
              checked={showOrientationGizmo}
              onCheckedChange={setShowOrientationGizmo}
            >
              Orientation Gizmo
            </MenubarCheckboxItem>
            <MenubarCheckboxItem
              checked={showSkyGeometry}
              onCheckedChange={setShowSkyGeometry}
            >
              Sky Geometry
            </MenubarCheckboxItem>
            <MenubarCheckboxItem
              checked={showGroundPlaneHelper}
              onCheckedChange={setShowGroundPlaneHelper}
            >
              Ground Plane Helper
            </MenubarCheckboxItem>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSeparator />
        <MenubarSub>
          <MenubarSubTrigger>Camera Rotation</MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarRadioGroup
              onValueChange={(value) => setCameraRotationMode(value as CameraRotationMode)}
              value={cameraRotationMode}
            >
              <MenubarRadioItem value="drag">Drag</MenubarRadioItem>
              <MenubarRadioItem value="scroll">Scroll</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarSubContent>
        </MenubarSub>
      </MenubarContent>
    );
  }

  function renderSkyMenu() {
    return (
      <MenubarContent>
        <MenubarSub>
          <MenubarSubTrigger>Geometry</MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarRadioGroup
              onValueChange={(value) => setSkyGeometryType(value as SkyGeometryType)}
              value={skyGeometryType}
            >
              <MenubarRadioItem value="box">Box</MenubarRadioItem>
              <MenubarRadioItem value="sphere">Sphere</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarSubContent>
        </MenubarSub>
        <MenubarSeparator />
        <MenubarSub>
          <MenubarSubTrigger>Mode</MenubarSubTrigger>
          <MenubarSubContent>
            <MenubarRadioGroup
              onValueChange={(value) => setSceneRenderMode(value as SceneRenderMode)}
              value={sceneRenderMode === "texture-baked" ? "live" : sceneRenderMode}
            >
              <MenubarRadioItem value="live">Live</MenubarRadioItem>
              <MenubarRadioItem disabled value="texture-baked">Texture Baked</MenubarRadioItem>
            </MenubarRadioGroup>
          </MenubarSubContent>
        </MenubarSub>
      </MenubarContent>
    );
  }

  return (
    <Menubar
      aria-label="Application menu"
      className="h-full rounded-none border-0 bg-background py-1 pr-16 pl-2 shadow-none"
    >
      {menuItems.map((item) => (
        <MenubarMenu key={item.id}>
          <MenubarTrigger
            className="leading-none"
            onPointerDown={() => emitMenuEvent(item.id)}
          >
            {item.label}
          </MenubarTrigger>
          {item.id === "file"
            ? renderFileMenu()
            : item.id === "view"
              ? renderViewMenu()
              : item.id === "sky"
                ? renderSkyMenu()
                : item.id === "edit"
                  ? renderCommandMenu(editMenuItems)
                  : item.id === "layer"
                    ? renderCommandMenu(layerMenuItems)
                    : item.items
                      ? renderCommandMenu(item.items)
                      : null}
        </MenubarMenu>
      ))}
    </Menubar>
  );
}

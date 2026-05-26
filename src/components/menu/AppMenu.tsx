import { useEffect, useRef } from "react";
import { HotkeyManager } from "@tanstack/hotkeys";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
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
} from "@/components/ui/menubar";
import { useWorkspaceStore } from "@/store/app";
import {
  type CameraRotationMode,
  type MenuCommandId,
  type MenuId,
  type SceneRenderMode,
  type SkyGeometryType,
} from "@/store/modules/scene";

type AppMenuItem = {
  disabled?: boolean;
  id: MenuCommandId;
  label: string;
  shortcut?: string[];
};

const fileMenuItems: AppMenuItem[] = [
  { id: "file.export", label: "Export" },
  { id: "file.load", label: "Load" },
];

const menuItems: Array<{
  id: MenuId;
  label: string;
  items?: AppMenuItem[];
}> = [
  {
    id: "file",
    label: "File",
    items: fileMenuItems,
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
  const toggleEffectLayerEnabled = useWorkspaceStore((state) => state.toggleEffectLayerEnabled);
  const undoRef = useRef(undoHistory);
  const redoRef = useRef(redoHistory);
  const deleteSelectedEffectLayerRef = useRef(deleteSelectedEffectLayer);
  const selectedLayerIdRef = useRef(selectedLayerId);
  const toggleEffectLayerEnabledRef = useRef(toggleEffectLayerEnabled);
  const modifierKeyLabel = getModifierKeyLabel();
  const deleteShortcutKey = getDeleteShortcutKey();
  const deleteShortcutLabel = getDeleteShortcutLabel();
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
      disabled: !selectedLayerId,
      id: "layer.toggle-visibility",
      label: "Toggle Visibility",
      shortcut: ["H"],
    },
    {
      disabled: !selectedLayerId,
      id: "layer.delete",
      label: "Delete",
      shortcut: [deleteShortcutLabel],
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
    selectedLayerIdRef.current = selectedLayerId;
  }, [selectedLayerId]);

  useEffect(() => {
    toggleEffectLayerEnabledRef.current = toggleEffectLayerEnabled;
  }, [toggleEffectLayerEnabled]);

  useEffect(() => {
    const hotkeys = HotkeyManager.getInstance();
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
      "H",
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

    return () => {
      undoHandle.unregister();
      redoHandle.unregister();
      toggleVisibilityHandle.unregister();
      deleteHandle.unregister();
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
          <MenubarItem
            disabled={menuItem.disabled}
            key={menuItem.id}
            onSelect={() => handleMenuCommand(menuItem.id)}
          >
            <span>{menuItem.label}</span>
            {menuItem.shortcut ? <Shortcut keys={menuItem.shortcut} /> : null}
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
          {item.id === "view"
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

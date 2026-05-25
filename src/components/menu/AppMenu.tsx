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
  { id: "view", label: "View" },
  { id: "sky", label: "Sky" },
];

function getModifierKeyLabel() {
  if (typeof navigator === "undefined") {
    return "Mod";
  }

  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
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
  const sceneRenderMode = useWorkspaceStore((state) => state.sceneRenderMode);
  const skyGeometryType = useWorkspaceStore((state) => state.skyGeometryType);
  const showGroundPlaneHelper = useWorkspaceStore((state) => state.showGroundPlaneHelper);
  const showOrientationGizmo = useWorkspaceStore((state) => state.showOrientationGizmo);
  const showSkyGeometry = useWorkspaceStore((state) => state.showSkyGeometry);
  const setSceneRenderMode = useWorkspaceStore((state) => state.setSceneRenderMode);
  const setSkyGeometryType = useWorkspaceStore((state) => state.setSkyGeometryType);
  const setShowGroundPlaneHelper = useWorkspaceStore((state) => state.setShowGroundPlaneHelper);
  const setShowOrientationGizmo = useWorkspaceStore((state) => state.setShowOrientationGizmo);
  const setShowSkyGeometry = useWorkspaceStore((state) => state.setShowSkyGeometry);
  const undoRef = useRef(undoHistory);
  const redoRef = useRef(redoHistory);
  const modifierKeyLabel = getModifierKeyLabel();
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

  useEffect(() => {
    undoRef.current = undoHistory;
  }, [undoHistory]);

  useEffect(() => {
    redoRef.current = redoHistory;
  }, [redoHistory]);

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

    return () => {
      undoHandle.unregister();
      redoHandle.unregister();
    };
  }, []);

  function handleMenuCommand(id: MenuCommandId) {
    if (id === "edit.undo") {
      undoHistory();
      return;
    }

    if (id === "edit.redo") {
      redoHistory();
      return;
    }

    emitMenuEvent(id);
  }

  function renderViewMenu() {
    return (
      <MenubarContent>
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
          {item.id === "view" ? renderViewMenu() : item.id === "sky" ? renderSkyMenu() : item.items || item.id === "edit" ? (
            <MenubarContent>
              {(item.id === "edit" ? editMenuItems : item.items ?? []).map((menuItem) => (
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
          ) : null}
        </MenubarMenu>
      ))}
    </Menubar>
  );
}

import { useEffect, useRef } from "react";
import { HotkeyManager } from "@tanstack/hotkeys";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useWorkspaceStore } from "@/store/app";
import {
  type MenuCommandId,
  type MenuId,
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
          {item.items || item.id === "edit" ? (
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

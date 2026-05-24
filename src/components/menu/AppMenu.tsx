import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar";
import {
  useWorkspaceStore,
  type MenuCommandId,
  type MenuId,
} from "@/store/workspace-store";

const menuItems: Array<{
  id: MenuId;
  label: string;
  items?: Array<{ id: MenuCommandId; label: string }>;
}> = [
  {
    id: "file",
    label: "File",
    items: [
      { id: "file.export", label: "Export" },
      { id: "file.load", label: "Load" },
    ],
  },
  { id: "edit", label: "Edit" },
];

export function AppMenu() {
  const emitMenuEvent = useWorkspaceStore((state) => state.emitMenuEvent);

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
          {item.items ? (
            <MenubarContent>
              {item.items.map((menuItem) => (
                <MenubarItem
                  key={menuItem.id}
                  onSelect={() => emitMenuEvent(menuItem.id)}
                >
                  {menuItem.label}
                </MenubarItem>
              ))}
            </MenubarContent>
          ) : null}
        </MenubarMenu>
      ))}
    </Menubar>
  );
}

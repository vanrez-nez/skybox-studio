import { GradientWidget } from "@/components/gradient/GradientWidget";
import { SidebarSampleWidget } from "@/components/sidebar/SidebarSampleWidget";

export function WorkspaceSidebar() {
  return (
    <aside aria-label="Workspace sidebar" className="flex h-full w-full flex-col gap-2 bg-sidebar p-2">
      <GradientWidget />
      <SidebarSampleWidget />
    </aside>
  );
}

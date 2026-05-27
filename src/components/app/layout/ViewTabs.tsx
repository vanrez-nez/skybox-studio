import { Eye, PencilRuler, type LucideIcon } from "lucide-react";

import { TabsList, TabsTrigger } from "@/components/ui/primitives/tabs";
import { workspaceViews, type WorkspaceView } from "@/store/modules/scene";

const viewIcons: Record<WorkspaceView, LucideIcon> = {
  editor: PencilRuler,
  preview: Eye,
};

export function ViewTabs() {
  return (
    <TabsList aria-label="Workspace views" className="h-full pl-2">
      {workspaceViews.map((view) => {
        const Icon = viewIcons[view.id];

        return (
          <TabsTrigger
            key={view.id}
            value={view.id}
            className="gap-1.5 leading-none"
          >
            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            {view.label}
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}

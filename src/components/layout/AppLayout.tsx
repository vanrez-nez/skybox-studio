import { AppMenu } from "@/components/menu/AppMenu";
import { ViewTabs } from "@/components/navigation/ViewTabs";
import { Tabs } from "@/components/ui/tabs";
import { WorkspaceViewport } from "@/components/workspace/WorkspaceViewport";
import { useWorkspaceStore, type WorkspaceView } from "@/store/workspace-store";
import { AppFooter } from "./AppFooter";
import { WorkspaceSplitLayout } from "./WorkspaceSplitLayout";

export function AppLayout() {
  const activeView = useWorkspaceStore((state) => state.activeView);
  const setActiveView = useWorkspaceStore((state) => state.setActiveView);

  return (
    <Tabs
      className="h-screen w-full gap-0 overflow-hidden"
      onValueChange={(value) => setActiveView(value as WorkspaceView)}
      value={activeView}
    >
      <header className="flex h-10 w-full items-center bg-sidebar py-0 pr-2 pl-0">
        <AppMenu />
        <ViewTabs />
      </header>
      <main className="flex min-h-0 flex-1">
        <WorkspaceSplitLayout>
          <WorkspaceViewport />
        </WorkspaceSplitLayout>
      </main>
      <AppFooter />
    </Tabs>
  );
}

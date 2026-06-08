import { useEffect, useState } from "react";

import { AppMenu } from "@/components/app/menu/AppMenu";
import { Tabs } from "@/components/ui/primitives/tabs";
import { WorkspaceViewport } from "@/components/scene/WorkspaceViewport";
import { useWorkspaceStore } from "@/store/app";
import type { WorkspaceView } from "@/store/modules/scene";
import { ImageExportDialog, RuntimeExportDialog } from "../dialogs/ExportDialog";
import { AppFooter } from "./AppFooter";
import { ViewTabs } from "./ViewTabs";
import { WorkspaceSplitLayout } from "./WorkspaceSplitLayout";

export function AppLayout() {
  const activeView = useWorkspaceStore((state) => state.activeView);
  const lastMenuEvent = useWorkspaceStore((state) => state.lastMenuEvent);
  const setActiveView = useWorkspaceStore((state) => state.setActiveView);
  const [isImageExportOpen, setIsImageExportOpen] = useState(false);
  const [isRuntimeExportOpen, setIsRuntimeExportOpen] = useState(false);

  useEffect(() => {
    if (lastMenuEvent?.id === "file.export.image") {
      setIsImageExportOpen(true);
    } else if (lastMenuEvent?.id === "file.export.runtime") {
      setIsRuntimeExportOpen(true);
    }
  }, [lastMenuEvent?.id, lastMenuEvent?.issuedAt]);

  return (
    <>
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

      <ImageExportDialog open={isImageExportOpen} onOpenChange={setIsImageExportOpen} />
      <RuntimeExportDialog open={isRuntimeExportOpen} onOpenChange={setIsRuntimeExportOpen} />
    </>
  );
}

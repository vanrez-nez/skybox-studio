import { useEffect, useState } from "react";

import { AppMenu } from "@/components/app/menu/AppMenu";
import { useDocumentLibrarySync } from "@/components/app/useDocumentLibrarySync";
import { Tabs } from "@/components/ui/primitives/tabs";
import { WorkspaceViewport } from "@/components/scene/WorkspaceViewport";
import { useWorkspaceStore } from "@/store/app";
import { openDocument } from "@/store/document-actions";
import type { WorkspaceView } from "@/store/modules/scene";
import { ImageExportDialog, RuntimeExportDialog } from "../dialogs/ExportDialog";
import { OpenDocumentDialog } from "../dialogs/OpenDocumentDialog";
import { AppFooter } from "./AppFooter";
import { DocumentTitle } from "./DocumentTitle";
import { WorkspaceSplitLayout } from "./WorkspaceSplitLayout";

export function AppLayout() {
  const activeView = useWorkspaceStore((state) => state.activeView);
  const lastMenuEvent = useWorkspaceStore((state) => state.lastMenuEvent);
  const setActiveView = useWorkspaceStore((state) => state.setActiveView);
  const [isImageExportOpen, setIsImageExportOpen] = useState(false);
  const [isRuntimeExportOpen, setIsRuntimeExportOpen] = useState(false);
  const [isOpenDocumentOpen, setIsOpenDocumentOpen] = useState(false);

  useDocumentLibrarySync();

  useEffect(() => {
    if (lastMenuEvent?.id === "file.export.image") {
      setIsImageExportOpen(true);
    } else if (lastMenuEvent?.id === "file.export.runtime") {
      setIsRuntimeExportOpen(true);
    } else if (lastMenuEvent?.id === "file.open") {
      setIsOpenDocumentOpen(true);
    }
  }, [lastMenuEvent?.id, lastMenuEvent?.issuedAt]);

  return (
    <>
      <Tabs
        className="h-screen w-full gap-0 overflow-hidden"
        onValueChange={(value) => setActiveView(value as WorkspaceView)}
        value={activeView}
      >
        {/* 1fr / auto / 1fr so the document title stays truly centred regardless of menu width.
            The trailing column is empty — the view switcher floats over the scene instead. */}
        <header className="grid h-10 w-full grid-cols-[1fr_auto_1fr] items-center bg-sidebar px-2">
          <AppMenu />
          <DocumentTitle onShowAll={() => setIsOpenDocumentOpen(true)} />
        </header>
        <main className="flex min-h-0 flex-1">
          <WorkspaceSplitLayout>
            <WorkspaceViewport />
          </WorkspaceSplitLayout>
        </main>
        <AppFooter />
      </Tabs>

      <OpenDocumentDialog
        open={isOpenDocumentOpen}
        onOpen={openDocument}
        onOpenChange={setIsOpenDocumentOpen}
      />
      <ImageExportDialog open={isImageExportOpen} onOpenChange={setIsImageExportOpen} />
      <RuntimeExportDialog open={isRuntimeExportOpen} onOpenChange={setIsRuntimeExportOpen} />
    </>
  );
}

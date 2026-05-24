import { AppMenu } from "@/components/menu/AppMenu";
import { ViewTabs } from "@/components/navigation/ViewTabs";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { EditorView } from "@/components/views/EditorView";
import { PreviewView } from "@/components/views/PreviewView";
import { useWorkspaceStore, type WorkspaceView } from "@/store/workspace-store";
import { AppFooter } from "./AppFooter";

export function AppLayout() {
  const activeView = useWorkspaceStore((state) => state.activeView);
  const setActiveView = useWorkspaceStore((state) => state.setActiveView);

  return (
    <Tabs
      className="min-h-screen w-full"
      onValueChange={(value) => setActiveView(value as WorkspaceView)}
      value={activeView}
    >
      <header className="flex h-10 w-full items-center gap-2 border bg-muted py-0 pr-2 pl-0">
        <AppMenu />
        <ViewTabs />
      </header>
      <main className="flex min-h-0 flex-1">
        <TabsContent value="editor" className="m-0 flex-1">
          <EditorView />
        </TabsContent>
        <TabsContent value="preview" className="m-0 flex-1">
          <PreviewView />
        </TabsContent>
      </main>
      <AppFooter />
    </Tabs>
  );
}

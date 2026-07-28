import { ViewTabs } from "@/components/app/layout/ViewTabs";
import { EditorActionPanel } from "./EditorActionPanel";
import { FloatingActionPanel } from "./FloatingActionPanel";
import { ThreeWorkspaceScene } from "./ThreeWorkspaceScene";
import { useWorkspaceStore } from "@/store/app";
import { workspaceViews } from "@/store/modules/scene";

export function WorkspaceViewport() {
  const activeView = useWorkspaceStore((state) => state.activeView);
  const activeViewLabel =
    workspaceViews.find((workspaceView) => workspaceView.id === activeView)?.label ?? activeView;

  return (
    <section
      aria-label={`${activeViewLabel} mode`}
      className="relative h-full w-full overflow-hidden"
    >
      <ThreeWorkspaceScene mode={activeView} />
      {/* p-0 so the TabsList's own padding is the panel's padding — otherwise the pill sits
          inside a second, larger box. */}
      <FloatingActionPanel className="p-0" placement="top-center">
        <ViewTabs />
      </FloatingActionPanel>
      {activeView === "editor" ? <EditorActionPanel /> : null}
    </section>
  );
}

import { EditorActionPanel } from "@/components/editor/EditorActionPanel";
import { ThreeWorkspaceScene } from "@/components/workspace/ThreeWorkspaceScene";
import { useWorkspaceStore, workspaceViews } from "@/store/workspace-store";

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
      {activeView === "editor" ? <EditorActionPanel /> : null}
    </section>
  );
}

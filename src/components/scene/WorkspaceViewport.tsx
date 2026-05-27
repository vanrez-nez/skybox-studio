import { EditorActionPanel } from "./EditorActionPanel";
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
      {activeView === "editor" ? <EditorActionPanel /> : null}
    </section>
  );
}

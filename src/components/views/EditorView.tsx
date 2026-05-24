import { EditorActionPanel } from "@/components/editor/EditorActionPanel";

export function EditorView() {
  return (
    <section
      aria-label="Editor view"
      className="relative grid h-full place-items-center overflow-hidden"
    >
      <EditorActionPanel />
      <span>Editor</span>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Pencil } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/primitives/popover";
import { formatCompactRelativeTime } from "@/lib/datetime";
import { TITLE_MAX_LENGTH, openDocument, renameActiveDocument } from "@/store/document-actions";
import { listDocuments, useDocumentLibraryStore } from "@/store/document-library";

const TITLE_DISPLAY_LENGTH = 25;
const RECENT_COUNT = 5;

function truncateTitle(title: string): string {
  return title.length > TITLE_DISPLAY_LENGTH
    ? `${title.slice(0, TITLE_DISPLAY_LENGTH - 1)}…`
    : title;
}

// Identity control only: the active document's name (click to rename) plus a recents popover.
// Every file action — New, Make a Copy, Open, Export, Load — lives in the File menu.
export function DocumentTitle({ onShowAll }: { onShowAll: () => void }) {
  const documents = useDocumentLibraryStore((state) => state.documents);
  const activeId = useDocumentLibraryStore((state) => state.activeId);
  const activeTitle = (activeId && documents[activeId]?.title) || "Untitled";
  const recent = useMemo(() => listDocuments(documents).slice(0, RECENT_COUNT), [documents]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Routes Enter/Escape through the single blur commit path (Enter/Escape blur the input); "cancel"
  // skips the commit so Esc doesn't save the edited draft.
  const exitRef = useRef<"commit" | "cancel">("commit");

  useEffect(() => {
    if (!editing) {
      return;
    }

    const input = inputRef.current;

    input?.focus();
    input?.select();
  }, [editing]);

  function startEdit() {
    setDraft(activeTitle);
    exitRef.current = "commit";
    setEditing(true);
  }

  function handleBlur() {
    if (exitRef.current === "commit") {
      renameActiveDocument(draft);
    }

    exitRef.current = "commit";
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label="Document title"
        className="h-6 min-w-45 max-w-85 rounded-sm border border-ring bg-background px-1.5 text-sm text-foreground outline-none"
        maxLength={TITLE_MAX_LENGTH}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            exitRef.current = "commit";
            inputRef.current?.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            exitRef.current = "cancel";
            inputRef.current?.blur();
          }
        }}
        onBlur={handleBlur}
      />
    );
  }

  return (
    <div className="group/document-title flex min-w-0 max-w-85 items-center gap-0.5">
      <button
        className="inline-flex min-w-0 items-center gap-1 rounded-sm px-1 py-0.5 text-sm text-foreground transition-colors hover:text-muted-foreground"
        type="button"
        title={activeTitle}
        onClick={startEdit}
      >
        <Pencil
          aria-hidden
          className="size-3.5 flex-none opacity-0 transition-opacity group-hover/document-title:opacity-70"
        />
        <span className="min-w-0 truncate">{truncateTitle(activeTitle)}</span>
      </button>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="Recent documents"
            className="inline-flex size-5 flex-none items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover/document-title:opacity-100 data-[state=open]:opacity-100"
            type="button"
          >
            <ChevronDown aria-hidden className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="flex min-w-58 flex-col gap-px">
          {recent.map((entry) => (
            <button
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              type="button"
              onClick={() => {
                if (entry.id !== activeId) {
                  openDocument(entry.id);
                }

                setMenuOpen(false);
              }}
            >
              <span className="min-w-0 truncate">{truncateTitle(entry.title)}</span>
              <span className="flex-none text-xs text-muted-foreground">
                {formatCompactRelativeTime(entry.updatedAt)}
              </span>
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            className="w-full rounded-sm px-2 py-1.5 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onShowAll();
            }}
          >
            Show All
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

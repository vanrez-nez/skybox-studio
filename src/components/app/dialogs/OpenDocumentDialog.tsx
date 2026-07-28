import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/primitives/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/primitives/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/primitives/tooltip";
import { formatAbsoluteDateTime, formatRelativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { TITLE_MAX_LENGTH, removeDocument, renameDocument } from "@/store/document-actions";
import { listDocuments, useDocumentLibraryStore } from "@/store/document-library";

type OpenDocumentDialogProps = {
  onOpen: (id: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function OpenDocumentDialog({ onOpen, onOpenChange, open }: OpenDocumentDialogProps) {
  const documents = useDocumentLibraryStore((state) => state.documents);
  const activeId = useDocumentLibraryStore((state) => state.activeId);
  const entries = useMemo(() => listDocuments(documents), [documents]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  // Same commit/cancel routing as the header rename: Enter and Escape both blur, this decides which.
  const exitRef = useRef<"commit" | "cancel">("commit");
  // Re-render periodically while open so the relative "last modified" text stays fresh.
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedId(activeId ?? entries[0]?.id ?? null);
  }, [open, activeId, entries]);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setPendingDeleteId(null);

      return undefined;
    }

    const interval = setInterval(() => setTick((tick) => tick + 1), 30_000);

    return () => clearInterval(interval);
  }, [open]);

  useEffect(() => {
    if (!editingId) {
      return;
    }

    const input = renameInputRef.current;

    input?.focus();
    input?.select();
  }, [editingId]);

  function startRename(id: string, title: string) {
    setDraft(title);
    exitRef.current = "commit";
    setEditingId(id);
  }

  function commitRename(id: string) {
    if (exitRef.current === "commit") {
      renameDocument(id, draft);
    }

    exitRef.current = "commit";
    setEditingId(null);
  }

  function handleOpen() {
    if (!selectedId) {
      return;
    }

    onOpen(selectedId);
    onOpenChange(false);
  }

  const pendingDeleteTitle = pendingDeleteId ? documents[pendingDeleteId]?.title : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Open Document</DialogTitle>
            <DialogDescription>Pick a saved document to open.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            {entries.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No saved documents yet.</p>
            ) : (
              <TooltipProvider>
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-full px-3 py-2 text-left font-medium">Title</th>
                      <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                        Last modified
                      </th>
                      <th className="w-16 px-3 py-2">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        aria-selected={selectedId === entry.id}
                        className={cn(
                          "group/row cursor-pointer border-t border-border/60 transition-colors hover:bg-accent",
                          selectedId === entry.id && "bg-accent"
                        )}
                        onClick={() => setSelectedId(entry.id)}
                        onDoubleClick={() => {
                          if (editingId === entry.id) {
                            return;
                          }

                          setSelectedId(entry.id);
                          onOpen(entry.id);
                          onOpenChange(false);
                        }}
                      >
                        {/* w-full + max-w-0 is the table trick that lets this cell absorb the leftover
                            width while still truncating instead of forcing the table wider. */}
                        <td className="w-full max-w-0 truncate px-3 py-2">
                          {editingId === entry.id ? (
                            <input
                              ref={renameInputRef}
                              aria-label="Document title"
                              className="w-full rounded-sm border border-ring bg-background px-1.5 py-0.5 text-sm text-foreground outline-none"
                              maxLength={TITLE_MAX_LENGTH}
                              value={draft}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => setDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  exitRef.current = "commit";
                                  event.currentTarget.blur();
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  exitRef.current = "cancel";
                                  event.currentTarget.blur();
                                }
                              }}
                              onBlur={() => commitRename(entry.id)}
                            />
                          ) : (
                            entry.title
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-muted-foreground">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">
                                {formatRelativeTime(entry.updatedAt)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {formatAbsoluteDateTime(entry.updatedAt)}
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-1 py-1">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
                            <Button
                              aria-label={`Rename ${entry.title}`}
                              className="size-7"
                              size="icon"
                              type="button"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                startRename(entry.id, entry.title);
                              }}
                            >
                              <Pencil aria-hidden className="size-3.5" />
                            </Button>
                            <Button
                              aria-label={`Delete ${entry.title}`}
                              className="size-7 hover:text-destructive"
                              size="icon"
                              type="button"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingDeleteId(entry.id);
                              }}
                            >
                              <Trash2 aria-hidden className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TooltipProvider>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" disabled={!selectedId} onClick={handleOpen}>
              Open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDeleteId !== null}
        onOpenChange={(next) => {
          if (!next) {
            setPendingDeleteId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              “{pendingDeleteTitle}” will be permanently removed. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingDeleteId) {
                  removeDocument(pendingDeleteId);
                }

                setPendingDeleteId(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

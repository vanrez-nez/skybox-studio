import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  createSkyboxDocument,
  migrateSkyboxDocument,
  type SkyboxDocument,
} from "@/effects/skybox-document";
import type { SkyGeometryType } from "@/store/modules/scene";

const DOCUMENT_LIBRARY_STORAGE_KEY = "skybox-studio-document-library";
const DEFAULT_TITLE = "Untitled";
const DEFAULT_GEOMETRY: SkyGeometryType = "box";

export type DocumentEntry = {
  document: SkyboxDocument;
  id: string;
  title: string;
  updatedAt: number;
};

export type DocumentLibraryStore = {
  activeId: string | null;
  documents: Record<string, DocumentEntry>;
  // Upsert the active document. Self-seeding: with no active entry it creates one and makes it active,
  // so the very first session is captured without any explicit "new" step.
  saveActive: (document: SkyboxDocument) => DocumentEntry;
  // Create an empty document, make it active, and return its entry.
  createDocument: () => DocumentEntry;
  // Create an entry from a supplied document (a copy, or a loaded file), make it active, and return it.
  importDocument: (document: SkyboxDocument, title?: string) => DocumentEntry;
  // Switch the active document; returns the entry (or null if the id is unknown).
  setActive: (id: string) => DocumentEntry | null;
  // Rename the active document (also stamps the title into its document metadata).
  renameActive: (title: string) => void;
  // Rename any entry by id — used by the Open dialog's per-row rename.
  renameDocument: (id: string, title: string) => void;
  // Remove an entry. Returns the entry that should become active afterwards (the newest remaining one,
  // a freshly created empty document if the library is now empty, or null when the deleted entry
  // wasn't the active one and nothing needs to change).
  deleteDocument: (id: string) => DocumentEntry | null;
};

function newId(): string {
  return crypto.randomUUID();
}

function documentTitle(document: SkyboxDocument): string | undefined {
  return document.metadata?.title?.trim() || undefined;
}

// Next "Untitled N" that doesn't collide with an existing entry title.
function nextUntitledTitle(documents: Record<string, DocumentEntry>): string {
  let max = 0;

  for (const entry of Object.values(documents)) {
    const match = /^Untitled(?:\s+(\d+))?$/.exec(entry.title.trim());

    if (match) {
      max = Math.max(max, match[1] ? Number(match[1]) : 1);
    }
  }

  return max === 0 ? DEFAULT_TITLE : `${DEFAULT_TITLE} ${max + 1}`;
}

// Stamp a title into the document metadata so files exported from the library carry their name.
function withTitle(document: SkyboxDocument, title: string): SkyboxDocument {
  return { ...document, metadata: { ...document.metadata, title } };
}

function createEntry(
  documents: Record<string, DocumentEntry>,
  document: SkyboxDocument,
  title?: string
): DocumentEntry {
  const resolvedTitle = title?.trim() || documentTitle(document) || nextUntitledTitle(documents);

  return {
    document: withTitle(document, resolvedTitle),
    id: newId(),
    title: resolvedTitle,
    updatedAt: Date.now(),
  };
}

export const useDocumentLibraryStore = create<DocumentLibraryStore>()(
  persist(
    (set, get) => ({
      activeId: null,
      documents: {},
      saveActive: (document) => {
        const state = get();
        const activeEntry = state.activeId ? state.documents[state.activeId] : undefined;

        if (!activeEntry) {
          const entry = createEntry(state.documents, document);

          set({
            activeId: entry.id,
            documents: { ...state.documents, [entry.id]: entry },
          });

          return entry;
        }

        const entry: DocumentEntry = {
          ...activeEntry,
          document: withTitle(document, activeEntry.title),
          updatedAt: Date.now(),
        };

        set({ documents: { ...state.documents, [entry.id]: entry } });

        return entry;
      },
      createDocument: () => {
        const state = get();
        const entry = createEntry(
          state.documents,
          createSkyboxDocument([], DEFAULT_GEOMETRY),
          nextUntitledTitle(state.documents)
        );

        set({
          activeId: entry.id,
          documents: { ...state.documents, [entry.id]: entry },
        });

        return entry;
      },
      importDocument: (document, title) => {
        const state = get();
        const entry = createEntry(state.documents, document, title);

        set({
          activeId: entry.id,
          documents: { ...state.documents, [entry.id]: entry },
        });

        return entry;
      },
      setActive: (id) => {
        const entry = get().documents[id];

        if (!entry) {
          return null;
        }

        set({ activeId: id });

        return entry;
      },
      renameActive: (title) => {
        const { activeId } = get();

        if (activeId) {
          get().renameDocument(activeId, title);
        }
      },
      renameDocument: (id, title) => {
        const state = get();
        const target = state.documents[id];

        if (!target) {
          return;
        }

        const entry: DocumentEntry = {
          ...target,
          document: withTitle(target.document, title),
          title,
          updatedAt: Date.now(),
        };

        set({ documents: { ...state.documents, [entry.id]: entry } });
      },
      deleteDocument: (id) => {
        const state = get();

        if (!state.documents[id]) {
          return null;
        }

        // Image blobs in IndexedDB are intentionally left alone: assets are shared across documents
        // (a copy references the same assetId), so deleting them here would blank out other documents.
        const documents = { ...state.documents };

        delete documents[id];

        if (state.activeId !== id) {
          set({ documents });

          return null;
        }

        const fallback = listDocuments(documents)[0];

        if (fallback) {
          set({ activeId: fallback.id, documents });

          return fallback;
        }

        const entry = createEntry({}, createSkyboxDocument([], DEFAULT_GEOMETRY), DEFAULT_TITLE);

        set({ activeId: entry.id, documents: { [entry.id]: entry } });

        return entry;
      },
    }),
    {
      name: DOCUMENT_LIBRARY_STORAGE_KEY,
      version: 1,
      // Documents persisted by an older app build are upgraded on read, so the rest of the app only
      // ever sees the current document format.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<DocumentLibraryStore> | undefined;
        const documents = Object.fromEntries(
          Object.entries(persisted?.documents ?? {}).map(([id, entry]) => [
            id,
            { ...entry, document: migrateSkyboxDocument(entry.document) },
          ])
        );

        return {
          ...currentState,
          activeId: persisted?.activeId ?? null,
          documents,
        };
      },
    }
  )
);

// Entries newest-first, for the recents menu and the Open dialog table.
export function listDocuments(documents: Record<string, DocumentEntry>): DocumentEntry[] {
  return Object.values(documents).sort((a, b) => b.updatedAt - a.updatedAt);
}

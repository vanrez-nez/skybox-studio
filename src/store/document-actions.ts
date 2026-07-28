import {
  cloneSkyboxDocument,
  createSkyboxDocument,
  migrateSkyboxDocument,
  readSkyboxDocumentLayers,
  type SkyboxDocument,
} from "@/effects/skybox-document";
import { downloadBlob } from "@/lib/project-export";
import { useWorkspaceStore } from "@/store/app";
import { useDocumentLibraryStore, type DocumentEntry } from "@/store/document-library";

const TITLE_MAX_LENGTH = 50;
const DEFAULT_TITLE = "Untitled";

// Load a library entry into the live editor and clear the undo stack so undo can't cross document
// boundaries. Unlike Material Designer there's no CustomEvent bridge to cross — the editor reads the
// same zustand store, and ThreeWorkspaceScene reacts to the new layers (rehydrating image blobs from
// IndexedDB by assetId).
function activateEntry(entry: DocumentEntry): void {
  const document = migrateSkyboxDocument(entry.document);

  useWorkspaceStore.setState({
    effectLayers: readSkyboxDocumentLayers(document),
    previewEffectLayerBlendMode: null,
    selectedLayerId: "",
    skyGeometryType: document.geometry,
  });
  useWorkspaceStore.getState().clearHistory();
}

// The live editor state as a document.
function currentDocument(): SkyboxDocument {
  const { effectLayers, skyGeometryType } = useWorkspaceStore.getState();

  return createSkyboxDocument(effectLayers, skyGeometryType);
}

// Snapshot the current document into its library entry before switching away, so nothing is lost.
function saveCurrent(): void {
  useDocumentLibraryStore.getState().saveActive(currentDocument());
}

export function newDocument(): void {
  saveCurrent();
  activateEntry(useDocumentLibraryStore.getState().createDocument());
}

// Fork the active document: snapshot the original into its own entry, then create a new library entry
// from a deep clone titled "Copy of <title>" and make it active — the editor switches to the copy while
// the original is preserved untouched.
export function duplicateActiveDocument(): void {
  saveCurrent();

  activateEntry(
    useDocumentLibraryStore
      .getState()
      .importDocument(cloneSkyboxDocument(currentDocument()), `Copy of ${activeTitle()}`)
  );
}

export function openDocument(id: string): void {
  saveCurrent();

  const entry = useDocumentLibraryStore.getState().setActive(id);

  if (entry) {
    activateEntry(entry);
  }
}

export function importDocumentFromFile(document: SkyboxDocument, title?: string): void {
  saveCurrent();
  activateEntry(
    useDocumentLibraryStore.getState().importDocument(migrateSkyboxDocument(document), title)
  );
}

export function removeDocument(id: string): void {
  const next = useDocumentLibraryStore.getState().deleteDocument(id);

  // deleteDocument only returns an entry when the ACTIVE document went away and the editor now has to
  // show something else.
  if (next) {
    activateEntry(next);
  }
}

// Rename the active document: clamps to 50 chars and ignores blank input (keeps the current title).
export function renameActiveDocument(rawTitle: string): void {
  const title = rawTitle.trim().slice(0, TITLE_MAX_LENGTH);

  if (!title) {
    return;
  }

  useDocumentLibraryStore.getState().renameActive(title);
}

export function renameDocument(id: string, rawTitle: string): void {
  const title = rawTitle.trim().slice(0, TITLE_MAX_LENGTH);

  if (!title) {
    return;
  }

  useDocumentLibraryStore.getState().renameDocument(id, title);
}

export function activeTitle(): string {
  const { activeId, documents } = useDocumentLibraryStore.getState();

  return (activeId ? documents[activeId]?.title : undefined) ?? DEFAULT_TITLE;
}

function toFileBaseName(title: string): string {
  return (
    title
      .trim()
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "skybox"
  );
}

// Save the live document as a .skybox.json file. Note this is NOT a portable bundle: image layers only
// carry an assetId pointing at this browser's IndexedDB, so a document opened elsewhere comes back with
// empty image layers. The runtime zip export remains the portable artifact.
export function downloadActiveDocument(): void {
  const title = activeTitle();
  const document = { ...currentDocument(), metadata: { title } };
  const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });

  downloadBlob(blob, `${toFileBaseName(title)}.skybox.json`);
}

export { TITLE_MAX_LENGTH };

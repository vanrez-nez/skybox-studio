import { useEffect } from "react";

import { createSkyboxDocument } from "@/effects/skybox-document";
import { useWorkspaceStore } from "@/store/app";
import { useDocumentLibraryStore } from "@/store/document-library";

const AUTOSAVE_DEBOUNCE_MS = 800;

// Keeps the document library in sync with the live editing session:
// - seeds the current sky as the first library entry on a fresh install, and
// - autosaves the active document (debounced) whenever the layer stack or sky geometry changes.
//
// The layers slice always produces a new `effectLayers` array on mutation, so identity comparison is
// enough to detect real edits — transient UI state (blend-mode hover preview, selection) is ignored.
export function useDocumentLibrarySync(): void {
  useEffect(() => {
    const library = useDocumentLibraryStore.getState();

    if (!library.activeId) {
      const { effectLayers, skyGeometryType } = useWorkspaceStore.getState();

      library.saveActive(createSkyboxDocument(effectLayers, skyGeometryType));
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = useWorkspaceStore.subscribe((state, previousState) => {
      if (
        state.effectLayers === previousState.effectLayers &&
        state.skyGeometryType === previousState.skyGeometryType
      ) {
        return;
      }

      clearTimeout(timer);
      timer = setTimeout(() => {
        const workspace = useWorkspaceStore.getState();

        useDocumentLibraryStore
          .getState()
          .saveActive(createSkyboxDocument(workspace.effectLayers, workspace.skyGeometryType));
      }, AUTOSAVE_DEBOUNCE_MS);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

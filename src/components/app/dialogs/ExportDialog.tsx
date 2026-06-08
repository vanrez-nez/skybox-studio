import { Fragment, useState } from "react";
import { Loader2 } from "lucide-react";

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
import { buildProjectBundle, downloadBlob } from "@/lib/project-export";
import { useWorkspaceStore } from "@/store/app";

import { BakePreview } from "./BakePreview";

type ExportDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

function ProjectBundleExport() {
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const skyGeometryType = useWorkspaceStore((state) => state.skyGeometryType);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  const handleExport = async () => {
    setIsExporting(true);
    setError("");

    try {
      const { blob, fileName } = await buildProjectBundle(effectLayers, skyGeometryType);

      downloadBlob(blob, fileName);
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : "Project export failed."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Fragment>
      <div className="flex flex-col gap-1">
        <span className="text-sm">Project bundle (.zip)</span>
        <span className="text-xs text-muted-foreground">
          manifest.json + hashed image assets for the standalone runtime.
        </span>
        {error ? (
          <span className="text-xs text-destructive" role="alert">
            {error}
          </span>
        ) : null}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={isExporting} onClick={handleExport} type="button">
          {isExporting ? <Loader2 className="animate-spin" /> : null}
          Export project
        </Button>
      </DialogFooter>
    </Fragment>
  );
}

export function ImageExportDialog({ onOpenChange, open }: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-none sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Export Image</DialogTitle>
          <DialogDescription>
            Bake the current sky to an equirectangular texture.
          </DialogDescription>
        </DialogHeader>
        <BakePreview />
      </DialogContent>
    </Dialog>
  );
}

export function RuntimeExportDialog({ onOpenChange, open }: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Runtime</DialogTitle>
          <DialogDescription>
            Package the project for the standalone runtime.
          </DialogDescription>
        </DialogHeader>
        <ProjectBundleExport />
      </DialogContent>
    </Dialog>
  );
}

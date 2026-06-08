import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { HelpHint } from "@/components/ui/composables/help-hint";
import { MarkdownContent } from "@/components/ui/composables/markdown-content";
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
import { Progress } from "@/components/ui/primitives/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/primitives/select";
import { Slider } from "@/components/ui/primitives/slider";
import { Switch } from "@/components/ui/primitives/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives/tabs";
import { getSkyboxExporter } from "@/lib/skybox-exporters";
import {
  buildProjectBundle,
  downloadBlob,
  type BundleAssetFormat,
} from "@/lib/project-export";
import { useWorkspaceStore } from "@/store/app";
import runtimeAssetQualityHelp from "@/help/runtime-asset-quality.md?raw";
import runtimeUsageFolder from "@/help/runtime-usage-folder.md?raw";
import runtimeUsageZip from "@/help/runtime-usage-zip.md?raw";

import { BakePreview } from "./BakePreview";

type ExportDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

const BUNDLE_FORMATS: { id: BundleAssetFormat; label: string }[] = [
  { id: "png", label: "PNG · lossless" },
  { id: "jpeg", label: "JPEG · lossy" },
  { id: "webp", label: "WebP · lossy" },
];

// Map a bundle format to the matching image exporter so the quality slider reuses the same
// min/max/step/default the Image export dialog uses.
function bundleQualityConfig(format: BundleAssetFormat) {
  if (format === "png") {
    return null;
  }

  return getSkyboxExporter(format)?.quality ?? null;
}

function RuntimeExportNextSteps() {
  return (
    <Tabs className="min-w-0 gap-3" defaultValue="zip">
      <TabsList>
        <TabsTrigger value="zip">Use as .zip</TabsTrigger>
        <TabsTrigger value="folder">Unzip to folder</TabsTrigger>
      </TabsList>
      <div className="min-w-0 max-h-[55vh] overflow-y-auto pr-1">
        <TabsContent className="min-w-0" value="zip">
          <MarkdownContent content={runtimeUsageZip} />
        </TabsContent>
        <TabsContent className="min-w-0" value="folder">
          <MarkdownContent content={runtimeUsageFolder} />
        </TabsContent>
      </div>
    </Tabs>
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
  const effectLayers = useWorkspaceStore((state) => state.effectLayers);
  const skyGeometryType = useWorkspaceStore((state) => state.skyGeometryType);
  const [format, setFormat] = useState<BundleAssetFormat>("png");
  const [quality, setQuality] = useState(1);
  const [visibleOnly, setVisibleOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [exported, setExported] = useState(false);

  // Opening (or closing) the dialog resets back to the options view with defaults.
  useEffect(() => {
    setFormat("png");
    setQuality(1);
    setVisibleOnly(false);
    setIsExporting(false);
    setProgress(0);
    setError("");
    setExported(false);
  }, [open]);

  const qualityConfig = bundleQualityConfig(format);
  // Keep the slider mounted for every format; PNG (no quality config) shows it disabled at 100%.
  const sliderConfig = qualityConfig ?? { default: 1, max: 1, min: 0.1, step: 0.01 };

  const handleFormatChange = (value: string) => {
    const nextFormat = value as BundleAssetFormat;

    setFormat(nextFormat);
    setQuality(bundleQualityConfig(nextFormat)?.default ?? 1);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError("");
    setProgress(0);

    try {
      const { blob, fileName } = await buildProjectBundle(effectLayers, skyGeometryType, {
        format,
        onProgress: (completed, total) => setProgress(total ? completed / total : 1),
        quality: qualityConfig ? quality : undefined,
        visibleOnly,
      });

      downloadBlob(blob, fileName);
      setExported(true);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Project export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (isExporting ? undefined : onOpenChange(next))}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={!isExporting}>
        {exported ? (
          <>
            <DialogHeader>
              <DialogTitle>Export Runtime</DialogTitle>
              <DialogDescription>
                Your project was exported. Next steps to use your skybox in a project:
              </DialogDescription>
            </DialogHeader>
            <RuntimeExportNextSteps />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button">Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Export Runtime</DialogTitle>
              <DialogDescription>
                Package the project (manifest.json + image assets) for the standalone runtime.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-sm">Asset format</span>
                  <span className="text-xs text-muted-foreground">Compression for image layers.</span>
                </div>
                <Select onValueChange={handleFormatChange} value={format}>
                  <SelectTrigger aria-label="Asset format" className="w-40 bg-background" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUNDLE_FORMATS.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <span className="flex shrink-0 items-center gap-0.5 text-sm">
                  Quality
                  <HelpHint
                    ariaLabel="Asset quality help"
                    doc={runtimeAssetQualityHelp}
                    size="xs"
                    trigger="hover"
                  />
                </span>
                <Slider
                  aria-label="Asset quality"
                  className="flex-1"
                  disabled={!qualityConfig}
                  max={sliderConfig.max}
                  min={sliderConfig.min}
                  onValueChange={([value]) => setQuality(value)}
                  step={sliderConfig.step}
                  value={[qualityConfig ? quality : 1]}
                />
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {qualityConfig ? `${Math.round(quality * 100)}%` : "—"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-sm">Only visible layers</span>
                  <span className="text-xs text-muted-foreground">
                    Exclude hidden layers and their assets.
                  </span>
                </div>
                <Switch
                  aria-label="Only visible layers"
                  checked={visibleOnly}
                  onCheckedChange={setVisibleOnly}
                />
              </div>

              {isExporting ? <Progress value={progress} /> : null}

              {error ? (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button disabled={isExporting} type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={isExporting} onClick={handleExport} type="button">
                {isExporting ? <Loader2 className="animate-spin" /> : null}
                Export project
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/primitives/dialog";

import { BakePreview } from "./BakePreview";

type ExportDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ExportDialog({ onOpenChange, open }: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-auto max-w-none sm:max-w-none">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
        </DialogHeader>
        <BakePreview />
      </DialogContent>
    </Dialog>
  );
}

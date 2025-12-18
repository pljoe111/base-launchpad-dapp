import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RefundModalProps {
  open: boolean;
  onClose: () => void;
}

export function RefundModal({ open, onClose }: RefundModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Refunds Unavailable</DialogTitle>
          <DialogDescription className="pt-2">
            Refunds are not available in this MVP.
            <br />
            <br />
            Refund functionality will be implemented in future campaigns.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

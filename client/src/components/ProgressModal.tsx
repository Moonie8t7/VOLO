import { Settings } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ProgressModalProps {
  isOpen: boolean;
}

export default function ProgressModal({ isOpen }: ProgressModalProps) {
  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl" aria-describedby="optimization-description">
        <VisuallyHidden>
          <DialogTitle>Load Order Optimisation</DialogTitle>
        </VisuallyHidden>
        <DialogDescription id="optimization-description" className="sr-only">
          VOLO is optimising your mod load order by analysing dependencies and applying community rules
        </DialogDescription>
        
        <div className="text-center p-6">
          <div className="w-16 h-16 bg-bg3-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Settings className="text-bg3-gold text-2xl animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2 font-display">Optimising Load Order</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Analysing dependencies and applying optimisation rules...
          </p>
          
          <Progress value={65} className="mb-4 bg-bg3-gold/20" />
          
          <div className="text-sm text-muted-foreground">
            Processing optimisation algorithms...
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

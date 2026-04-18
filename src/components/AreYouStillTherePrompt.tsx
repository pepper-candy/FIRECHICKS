import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AreYouStillTherePromptProps {
  onRespond: () => void;
  autoHideMs?: number;
}

export const AreYouStillTherePrompt = ({
  onRespond,
  autoHideMs = 12000, // Hide after 12s (before 15s disconnect)
}: AreYouStillTherePromptProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, autoHideMs);

    return () => clearTimeout(timer);
  }, [autoHideMs]);

  if (!isVisible) return null;

  const handleRespond = () => {
    onRespond();
    setIsVisible(false);
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="bg-destructive/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs border border-destructive">
        <p className="text-sm font-semibold text-destructive-foreground mb-3">
          Are you still there?
        </p>
        <Button
          onClick={handleRespond}
          size="sm"
          className="w-full bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90 gap-2"
        >
          <Check className="w-4 h-4" />
          Yes, I'm here
        </Button>
        <p className="text-xs text-destructive-foreground/70 mt-2">
          You'll be disconnected in 15 seconds if you don't respond.
        </p>
      </div>
    </div>
  );
};

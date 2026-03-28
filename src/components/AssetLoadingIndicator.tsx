import { Check, Loader2 } from "lucide-react";
import { useAssetLoading } from "@/context/AssetLoadingContext";

export default function AssetLoadingIndicator() {
  const { entryProgress, entryReady } = useAssetLoading();

  return (
    <div className="fixed bottom-3 left-3 z-40 flex items-center gap-2 px-3 py-1 rounded-lg bg-card/90 border border-border backdrop-blur-sm shadow-lg">
      {entryReady ? (
        <>
          <Check className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-mono text-primary">Loaded</span>
        </>
      ) : (
        <>
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          <span className="text-[11px] font-mono text-muted-foreground">{entryProgress}%</span>
        </>
      )}
    </div>
  );
}

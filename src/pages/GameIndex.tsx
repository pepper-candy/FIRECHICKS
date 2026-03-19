import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { preloadAllAnimations } from "@/lib/preloadAssets";

const Index = () => {
  const navigate = useNavigate();

  // Preload all FireChick animations on app launch
  useEffect(() => {
    preloadAllAnimations();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-10">
      <div className="text-center space-y-4">
        <h1 className="text-xl md:text-3xl text-primary text-glow-green tracking-wider leading-relaxed">
          EAGLE VS CHICK
        </h1>
        <p className="text-sm text-muted-foreground font-mono max-w-md">1 V 3 — control characters across devices</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button
          onClick={() => navigate("/host")}
          className="h-14 text-sm font-pixel bg-primary hover:bg-primary/80 text-primary-foreground glow-green"
        >
          HOST GAME
        </Button>
        <Button
          onClick={() => navigate("/client")}
          variant="outline"
          className="h-14 text-sm font-pixel border-secondary text-secondary hover:bg-secondary/10 glow-purple"
        >
          JOIN GAME
        </Button>
        <Button
          onClick={() => navigate("/character")}
          variant="outline"
          className="h-14 text-sm font-pixel border-accent text-accent hover:bg-accent/10"
        >
          🐤 CHARACTER 🐤
        </Button>
        <Button
          onClick={() => navigate("/pw")}
          variant="outline"
          className="h-14 text-sm font-pixel border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          🔒 PW EXAM 🔑
        </Button>
        <Button
          onClick={() => navigate("/exam-tips")}
          variant="outline"
          className="h-14 text-sm font-pixel border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          EXAM TIPS
        </Button>
        <Button
          onClick={() => navigate("/battlefield")}
          variant="ghost"
          className="h-14 text-sm font-pixel text-muted-foreground hover:text-foreground"
        >
          ⚔ BATTLEFIELD (TEST)
        </Button>
      </div>

      <div className="text-xs text-muted-foreground font-mono text-center space-y-1 mt-8">
        <p>1. Host opens the lobby on a big screen</p>
        <p>2. Players join from phones with the room code</p>
        <p>3. 1 Eagle (Black) vs 3 Chicks (Yellow, Green, Cyan)</p>
      </div>
    </div>
  );
};

export default Index;

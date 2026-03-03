import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { ConnectionMode } from '@/hooks/useGameRoom';

const Index = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<ConnectionMode>('webrtc');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-10">
      <div className="text-center space-y-4">
        <h1 className="text-xl md:text-3xl text-primary text-glow-green tracking-wider leading-relaxed">
          EAGLE VS CHICK
        </h1>
        <p className="text-sm text-muted-foreground font-mono max-w-md">
          Control characters across devices using a virtual thumbstick
        </p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button
          onClick={() => navigate(`/host?mode=${mode}`)}
          className="h-14 text-sm font-pixel bg-primary hover:bg-primary/80 text-primary-foreground glow-green"
        >
          HOST GAME
        </Button>
        <Button
          onClick={() => navigate('/client')}
          variant="outline"
          className="h-14 text-sm font-pixel border-secondary text-secondary hover:bg-secondary/10 glow-purple"
        >
          JOIN GAME
        </Button>

        {/* Mode Switch */}
        <div className="flex items-center justify-between px-3 py-3 rounded border border-border bg-card mt-2">
          <Label className="text-xs font-mono text-muted-foreground cursor-pointer">
            {mode === 'webrtc' ? (
              <span><span className="text-primary">WebRTC</span> — Same network, low latency</span>
            ) : (
              <span><span className="text-secondary">Supabase</span> — Remote play, any network</span>
            )}
          </Label>
          <Switch
            checked={mode === 'supabase'}
            onCheckedChange={(checked) => setMode(checked ? 'supabase' : 'webrtc')}
          />
        </div>
      </div>

      <div className="text-xs text-muted-foreground font-mono text-center space-y-1 mt-8">
        <p>1. Host opens the arena on a big screen</p>
        <p>2. Client joins from a phone with the room code</p>
        <p>3. Use the thumbstick to control movement</p>
      </div>
    </div>
  );
};

export default Index;

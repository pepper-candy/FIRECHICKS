import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Index = () => {
  const navigate = useNavigate();

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
          onClick={() => navigate('/host')}
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

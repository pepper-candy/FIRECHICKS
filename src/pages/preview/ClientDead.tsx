export default function PreviewClientDead() {
  return (
    <div className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-6 bg-background">
      <div className="text-9xl font-pixel text-destructive" style={{ textShadow: '0 0 30px hsl(0 80% 55% / 0.8)' }}>
        F
      </div>
      <p className="text-xl font-mono text-destructive tracking-widest">ELIMINATED</p>
      <p className="text-xs text-muted-foreground font-mono">Better luck next time...</p>
    </div>
  );
}

export default function PreviewHostCountdown() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-4 bg-background">
      <h1 className="text-xl font-pixel text-primary text-glow-green">GET READY</h1>
      <div className="text-8xl font-pixel text-accent animate-pulse" style={{ textShadow: '0 0 30px hsl(var(--accent) / 0.8)' }}>
        3
      </div>
      <p className="text-sm font-mono text-muted-foreground">Game starting soon!</p>
    </div>
  );
}

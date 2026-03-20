export default function PreviewClientCountdown() {
  return (
    <div className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-6 bg-background">
      <h2 className="text-lg font-pixel text-primary text-glow-green">GET READY</h2>
      <div className="text-7xl font-pixel text-accent animate-pulse">3</div>
      <p className="text-xs font-mono text-muted-foreground text-center max-w-xs px-4">
        🐤 You get a 5-second head start!
      </p>
    </div>
  );
}

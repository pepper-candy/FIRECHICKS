interface Props {
  timeRemaining: number;
}

export default function EagleExamView({ timeRemaining }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6">
      <div className="text-4xl">🦅</div>
      <p className="text-lg font-pixel text-destructive text-center">DISTRACT THE CHICKS!</p>
      <p className="text-sm font-mono text-muted-foreground text-center max-w-xs">
        The chicks are doing their exam now. Make noise, distract them in real life!
      </p>
      <div className="px-4 py-2 rounded border border-border font-mono text-sm text-muted-foreground">
        ⏱ {Math.ceil(timeRemaining)}s remaining
      </div>
    </div>
  );
}

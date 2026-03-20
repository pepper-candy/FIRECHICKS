interface Props {
  type: 'mock-exam' | 'hitbox';
  secondsLeft: number;
}

export default function EventCountdown({ type, secondsLeft }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h2 className="text-2xl font-pixel text-accent">
        {type === 'mock-exam' ? '📝 MOCK EXAM' : '👊 HITBOX CHALLENGE'}
      </h2>
      <div className="text-6xl font-pixel text-primary animate-pulse">
        {Math.max(1, secondsLeft)}
      </div>
      <p className="text-sm font-mono text-muted-foreground">Get ready!</p>
    </div>
  );
}

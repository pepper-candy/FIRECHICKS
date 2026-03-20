interface Props {
  timeLeft: number;
  isEagle: boolean;
  onHit: () => void;
}

export default function HitboxClient({ timeLeft, isEagle, onHit }: Props) {
  return (
    <div className="flex flex-col items-center justify-between h-full p-4">
      <div className="text-center">
        <h2 className="text-lg font-pixel text-accent">👊 HITBOX BATTLE</h2>
        <p className="text-2xl font-pixel text-primary">{timeLeft}s</p>
      </div>
      <button
        onClick={onHit}
        className="w-48 h-48 rounded-full border-4 border-accent bg-accent/20 active:scale-90 transition-all flex items-center justify-center"
        style={{ boxShadow: '0 0 30px hsl(var(--accent) / 0.5)' }}
      >
        <span className="text-3xl font-pixel text-accent">HIT!</span>
      </button>
      <p className="text-xs font-mono text-muted-foreground">
        {isEagle ? '🦅 Eagle' : '🐤 Chick'} — tap as fast as you can!
      </p>
    </div>
  );
}

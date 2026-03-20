interface Props {
  result: 'chick' | 'eagle' | 'pending';
  type: 'mock-exam' | 'hitbox';
}

export default function EventResult({ result, type }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <h2 className="text-xl font-pixel text-accent">
        {type === 'mock-exam' ? '📝 MOCK EXAM' : '👊 HITBOX'} RESULT
      </h2>
      <p
        className="text-2xl font-pixel"
        style={{ color: result === 'chick' ? 'hsl(145 80% 50%)' : 'hsl(0 80% 55%)' }}
      >
        {result === 'chick' ? '🐤 Chicks Win!' : '🦅 Eagle Wins!'}
      </p>
      <p className="text-xs font-mono text-muted-foreground">
        {result === 'chick' ? '+2 grades for everyone!' : '-2 grades for chicks'}
      </p>
    </div>
  );
}

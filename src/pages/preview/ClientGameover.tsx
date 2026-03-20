import { gradeToLetter, getGradeColor } from '@/lib/gradeSystem';
import { Button } from '@/components/ui/button';

export default function PreviewClientGameover() {
  const myHealth = 3.3; // B+
  const winner = 'chicks';
  const isEagle = false;
  const amWinner = (winner === 'chicks' && !isEagle);

  return (
    <div className="flex flex-col items-center justify-center h-dvh overflow-hidden gap-6 p-4 bg-background">
      <h1 className="text-2xl font-pixel text-accent">GAME OVER</h1>
      <p className="text-lg font-pixel" style={{ color: 'hsl(145 80% 50%)' }}>🐤 Chicks Win!</p>
      <div className="flex flex-col items-center gap-1">
        <span className="text-4xl font-bold" style={{ color: getGradeColor(myHealth) }}>
          {gradeToLetter(myHealth)}
        </span>
        <span className="text-sm font-mono text-muted-foreground">Your final grade</span>
      </div>
      {amWinner && <p className="text-lg font-pixel text-primary text-glow-green">🎉 YOU WIN!</p>}
      <Button variant="outline" size="sm" className="text-xs font-mono">LEAVE</Button>
    </div>
  );
}

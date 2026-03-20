import { Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import CharacterViewer from '@/components/CharacterViewer';
import { PLAYER_COLORS } from '@/lib/playerColors';
import { gradeToLetter, getGradeColor } from '@/lib/gradeSystem';
import { Trophy, Star } from 'lucide-react';
import { createMockSnapshot } from './mockData';

function DancingChar({ chickColor, isWinner, delay }: { chickColor: string; isWinner: boolean; delay: number }) {
  const angleRef = useRef(delay);
  useFrame((_, d) => { angleRef.current += d * (isWinner ? 1.5 : 0.4); });
  return (
    <Suspense fallback={null}>
      <CharacterViewer color={chickColor as any} animState={isWinner ? 'Victory' : 'Idle'} facingAngle={angleRef.current} />
    </Suspense>
  );
}

export default function PreviewHostGameover() {
  const snapshot = createMockSnapshot({
    phase: 'gameover',
    winner: 'chicks',
  });

  const winner = snapshot.winner;
  const sorted = Object.values(snapshot.players).sort((a, b) => {
    const aWin = (winner === 'eagle' && a.isEagle) || (winner === 'chicks' && !a.isEagle);
    const bWin = (winner === 'eagle' && b.isEagle) || (winner === 'chicks' && !b.isEagle);
    if (aWin !== bWin) return aWin ? -1 : 1;
    return b.actionScore - a.actionScore;
  });
  const mvp = sorted[0];

  return (
    <div className="flex flex-col h-screen bg-background overflow-auto">
      <div className="py-4 text-center border-b border-border">
        <h1 className="text-xl font-pixel text-accent text-glow-green mb-1">GAME OVER</h1>
        <p className="text-lg font-pixel" style={{ color: 'hsl(145 80% 50%)' }}>🐤 Chicks Win!</p>
      </div>

      <div className="h-[35vh] relative flex-shrink-0">
        <Canvas camera={{ position: [0, 3, sorted.length * 2.2 + 4], fov: 40 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} />
          {sorted.map((p, i) => {
            const isWin = (winner === 'chicks' && !p.isEagle);
            const x = (i - (sorted.length - 1) / 2) * 2.2;
            return (
              <group key={p.connId} position={[x, 0, 0]}>
                <DancingChar chickColor={p.chickColor} isWinner={isWin} delay={i * 0.4} />
              </group>
            );
          })}
        </Canvas>
        {mvp && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded bg-accent/20 border border-accent">
            <Trophy className="w-4 h-4 text-accent" />
            <span className="text-xs font-pixel text-accent">MVP: {PLAYER_COLORS[mvp.colorIndex]?.name ?? '?'}</span>
          </div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <h2 className="text-center text-sm font-pixel text-foreground mb-4 tracking-widest">📋 TRANSCRIPT</h2>
        <div className="max-w-3xl mx-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="py-2 text-left pl-2">Player</th>
                <th className="py-2 text-center">Grade</th>
                <th className="py-2 text-center">Score</th>
                <th className="py-2 text-center">Result</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const color = PLAYER_COLORS[p.colorIndex];
                const letter = gradeToLetter(p.health);
                const gradeColor = getGradeColor(p.health);
                const isWin = (winner === 'chicks' && !p.isEagle);
                return (
                  <tr key={p.connId} className="border-b border-border/40">
                    <td className="py-2 pl-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: `hsl(${color?.hsl ?? '0 0% 50%'})` }} />
                        <span style={{ color: `hsl(${color?.hsl ?? '0 0% 50%'})` }}>{color?.name}</span>
                        {p.isEagle ? ' 🦅' : ' 🐤'}
                        {p.isStarStudent && <Star className="w-3 h-3 text-accent fill-accent ml-0.5" />}
                      </div>
                    </td>
                    <td className="py-2 text-center">
                      <span className="text-xl font-bold" style={{ color: gradeColor }}>{letter}</span>
                    </td>
                    <td className="py-2 text-center text-foreground font-bold">{p.actionScore.toFixed(0)}</td>
                    <td className="py-2 text-center">
                      {isWin ? <span className="text-primary font-bold">WIN</span> : <span className="text-destructive">LOSE</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

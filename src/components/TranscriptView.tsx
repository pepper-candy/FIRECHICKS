import { Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import CharacterViewer from '@/components/CharacterViewer';
import { PLAYER_COLORS } from '@/lib/playerColors';
import { gradeToLetter, getGradeColor } from '@/lib/gradeSystem';
import type { PlayerGameStateSerializable } from '@/lib/gameTypes';
import { useRef } from 'react';
import { Star, Trophy } from 'lucide-react';

interface Props {
  players: Record<string, PlayerGameStateSerializable>;
  winner: 'eagle' | 'chicks' | 'draw' | null;
}

function DancingCharacter({ chickColor, isWinner, delay }: {
  chickColor: string;
  isWinner: boolean;
  delay: number;
}) {
  const angleRef = useRef(delay);
  useFrame((_, delta) => { angleRef.current += delta * (isWinner ? 1.5 : 0.5); });

  return (
    <Suspense fallback={null}>
      <CharacterViewer
        color={chickColor as any}
        animState={isWinner ? 'Victory' : 'Idle'}
        facingAngle={angleRef.current}
      />
    </Suspense>
  );
}

export default function Transcript({ players, winner }: Props) {
  const sorted = Object.values(players).sort((a, b) => {
    const aWin = winner === 'draw' || (winner === 'eagle' && a.isEagle) || (winner === 'chicks' && !a.isEagle);
    const bWin = winner === 'draw' || (winner === 'eagle' && b.isEagle) || (winner === 'chicks' && !b.isEagle);
    if (aWin !== bWin) return aWin ? -1 : 1;
    return b.actionScore - a.actionScore;
  });

  const mvp = sorted[0];

  return (
    <div className="flex flex-col h-screen">
      {/* 3D Characters */}
      <div className="h-[40vh] relative">
        <Canvas camera={{ position: [0, 3, 8], fov: 35 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[5, 8, 5]} intensity={1} />
          {sorted.map((p, i) => {
            const isWin = (winner === 'eagle' && p.isEagle) || (winner === 'chicks' && !p.isEagle);
            const spacing = 2.5;
            const x = (i - (sorted.length - 1) / 2) * spacing;
            return (
              <group key={p.connId} position={[x, 0, 0]}>
                <DancingCharacter chickColor={p.chickColor} isWinner={isWin} delay={i * 0.5} />
              </group>
            );
          })}
        </Canvas>

        {/* MVP badge */}
        {mvp && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded bg-accent/20 border border-accent">
            <Trophy className="w-5 h-5 text-accent" />
            <span className="text-sm font-pixel text-accent">
              MVP: {PLAYER_COLORS[mvp.colorIndex]?.name ?? '?'}
            </span>
          </div>
        )}
      </div>

      {/* Stats table */}
      <div className="flex-1 overflow-auto p-4">
        <h2 className="text-center text-lg font-pixel text-foreground mb-4">TRANSCRIPT</h2>
        <div className="max-w-2xl mx-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="py-2 text-left">Player</th>
                <th className="py-2 text-center">Grade</th>
                <th className="py-2 text-center">Role</th>
                <th className="py-2 text-center">Score</th>
                <th className="py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const color = PLAYER_COLORS[p.colorIndex];
                const letter = gradeToLetter(p.health);
                const gradeColor = getGradeColor(p.health);
                const isDraw = winner === 'draw';
                const isWin = !isDraw && ((winner === 'eagle' && p.isEagle) || (winner === 'chicks' && !p.isEagle));

                return (
                  <tr key={p.connId} className="border-b border-border/50">
                    <td className="py-3 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: `hsl(${color?.hsl ?? '0 0% 50%'})` }} />
                      <span style={{ color: `hsl(${color?.hsl ?? '0 0% 50%'})` }}>{color?.name}</span>
                      {p.isStarStudent && <Star className="w-3 h-3 text-accent fill-accent" />}
                      {p.connId === mvp?.connId && <Trophy className="w-3 h-3 text-accent" />}
                    </td>
                    <td className="py-3 text-center">
                      <span className="text-2xl font-bold" style={{ color: gradeColor }}>{letter}</span>
                    </td>
                    <td className="py-3 text-center">{p.isEagle ? '🦅' : '🐤'}</td>
                    <td className="py-3 text-center text-foreground">{p.actionScore.toFixed(0)}</td>
                    <td className="py-3 text-center">
                      {isDraw
                        ? <span style={{ color: 'hsl(45 100% 55%)' }} className="font-bold">DRAW</span>
                        : isWin
                          ? <span className="text-primary font-bold">WIN</span>
                          : <span className="text-destructive">LOSE</span>
                      }
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

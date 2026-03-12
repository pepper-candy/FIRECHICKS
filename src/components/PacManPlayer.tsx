import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OFFSET_X, OFFSET_Z, findStartCell, getNeighbors, Dir } from '@/lib/mazeData';

const SPEED = 3; // cells per second

const PacManPlayer = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const stateRef = useRef(() => {
    const [sr, sc] = findStartCell();
    const neighbors = getNeighbors(sr, sc);
    const dir = neighbors[0] || [0, 1];
    return {
      row: sr,
      col: sc,
      targetRow: sr + dir[0],
      targetCol: sc + dir[1],
      dir: dir as Dir,
      progress: 0,
    };
  });

  // Lazily init
  const state = useRef<{
    row: number; col: number;
    targetRow: number; targetCol: number;
    dir: Dir; progress: number;
  } | null>(null);

  if (!state.current) {
    const [sr, sc] = findStartCell();
    const neighbors = getNeighbors(sr, sc);
    const dir: Dir = neighbors[0] || [0, 1];
    state.current = {
      row: sr, col: sc,
      targetRow: sr + dir[0], targetCol: sc + dir[1],
      dir, progress: 0,
    };
  }

  useFrame((_, delta) => {
    const s = state.current!;
    const mesh = meshRef.current;
    if (!mesh) return;

    s.progress += delta * SPEED;

    if (s.progress >= 1) {
      // Arrived at target
      s.row = s.targetRow;
      s.col = s.targetCol;
      s.progress = 0;

      // Pick next direction
      const neighbors = getNeighbors(s.row, s.col);
      // Filter out reverse direction
      const reverse: Dir = [-s.dir[0] as -1 | 0 | 1, -s.dir[1] as -1 | 0 | 1];
      let choices = neighbors.filter(([dr, dc]) => !(dr === reverse[0] && dc === reverse[1]));
      if (choices.length === 0) choices = neighbors; // dead end, reverse

      const pick = choices[Math.floor(Math.random() * choices.length)];
      s.dir = pick;
      s.targetRow = s.row + pick[0];
      s.targetCol = s.col + pick[1];
    }

    // Interpolate position
    const x = THREE.MathUtils.lerp(s.col + OFFSET_X, s.targetCol + OFFSET_X, s.progress);
    const z = THREE.MathUtils.lerp(s.row + OFFSET_Z, s.targetRow + OFFSET_Z, s.progress);
    mesh.position.set(x, 0, z);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.35, 16, 16]} />
      <meshStandardMaterial color="yellow" emissive="yellow" emissiveIntensity={0.5} />
    </mesh>
  );
};

export default PacManPlayer;

import { MAZE, MAZE_ROWS, MAZE_COLS, OFFSET_X, OFFSET_Z } from '@/lib/mazeData';

const MazeEnvironment = () => {
  const walls: [number, number][] = [];
  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      if (MAZE[r][c] === 1) walls.push([r, c]);
    }
  }

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[MAZE_COLS + 2, MAZE_ROWS + 2]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* Walls */}
      {walls.map(([r, c]) => (
        <mesh key={`${r}-${c}`} position={[c + OFFSET_X, 0, r + OFFSET_Z]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color="#0044aa"
            emissive="#0066ff"
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}

      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 15, 0]} intensity={1.5} distance={50} />
    </group>
  );
};

export default MazeEnvironment;

import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { Link } from 'react-router-dom';
import MazeEnvironment from '@/components/MazeEnvironment';
import PacManPlayer from '@/components/PacManPlayer';

const Battlefield = () => {
  return (
    <div className="w-screen h-screen bg-black relative">
      <Canvas>
        <OrthographicCamera
          makeDefault
          position={[0, 14, 14]}
          zoom={28}
          near={0.1}
          far={100}
          rotation={[-Math.PI / 4, 0, 0]}
        />
        <MazeEnvironment />
        <PacManPlayer />
      </Canvas>

      <Link
        to="/"
        className="absolute top-4 left-4 text-sm text-muted-foreground hover:text-foreground font-mono z-10"
      >
        ← Back
      </Link>
    </div>
  );
};

export default Battlefield;

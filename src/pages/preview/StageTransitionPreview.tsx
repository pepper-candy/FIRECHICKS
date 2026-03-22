import { useState } from 'react';
import StageTransition from '@/components/StageTransition';

export default function PreviewStageTransition() {
  const [visible, setVisible] = useState(true);
  return (
    <div className="relative w-full h-screen bg-background">
      {!visible && (
        <button onClick={() => setVisible(true)} className="m-4 px-4 py-2 rounded border font-mono text-sm">
          Show again
        </button>
      )}
      {visible && <StageTransition stage={1} onDismiss={() => setVisible(false)} />}
    </div>
  );
}

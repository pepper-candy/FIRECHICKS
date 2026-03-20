import { createPortal } from 'react-dom';

interface Props {
  questionNum: number;
  timeLeft: number;
}

export default function MockExamHost({ questionNum, timeLeft }: Props) {
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-white" style={{ zIndex: 9998 }}>
      <div className="flex flex-col items-center gap-4 max-w-2xl w-full px-6">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg font-pixel text-gray-800">📝 MOCK EXAM</h2>
          <span className="font-mono text-lg font-bold text-gray-800">{timeLeft}s</span>
        </div>
        <div className="w-full border-2 border-gray-300 rounded-xl overflow-hidden bg-white shadow-lg">
          <img src={`/PW/PW_Mock_${questionNum}_layer-1.png`} alt="Layer 1" className="w-full" />
        </div>
        <p className="text-xs font-mono text-gray-500">Players check their phones for layer 2!</p>
      </div>
    </div>,
    document.body
  );
}

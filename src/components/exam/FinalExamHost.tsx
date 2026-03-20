import { assetUrl } from '@/lib/assets';

interface Props {
  questionNum: number;
  layer1Dead: boolean;
}

export default function FinalExamHost({ questionNum, layer1Dead }: Props) {
  if (!layer1Dead || questionNum <= 0) return null;

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-white border-2 border-accent rounded-xl p-4 max-w-md w-[90%] shadow-2xl">
      <p className="text-xs font-mono text-accent mb-2 text-center">📜 EXAM LAYER 1</p>
      <img
        src={assetUrl(`/PW/PW_Final_${questionNum}_layer-1.png`)}
        alt="Layer 1"
        className="w-full rounded"
      />
    </div>
  );
}

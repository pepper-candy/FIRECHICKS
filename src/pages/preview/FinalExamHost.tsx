import FinalExamHost from '@/components/exam/FinalExamHost';

export default function PreviewFinalExamHost() {
  return (
    <div className="relative h-dvh bg-background">
      <FinalExamHost questionNum={1} layer1Dead={true} />
    </div>
  );
}

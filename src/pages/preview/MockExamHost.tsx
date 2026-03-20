import MockExamHost from '@/components/events/MockExamHost';

export default function PreviewMockExamHost() {
  return (
    <div className="h-dvh bg-background">
      <MockExamHost questionNum={1} timeLeft={25} />
    </div>
  );
}

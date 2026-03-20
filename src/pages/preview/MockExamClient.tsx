import { useState } from 'react';
import MockExamClient from '@/components/events/MockExamClient';

export default function PreviewMockExamClient() {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="h-dvh bg-background">
      <MockExamClient
        questionNum={1}
        timeLeft={25}
        isEagle={false}
        hasSubmitted={submitted}
        answer={answer}
        onAnswerChange={setAnswer}
        onSubmit={() => setSubmitted(true)}
      />
    </div>
  );
}

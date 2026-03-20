import { useState } from 'react';
import FinalExamClient from '@/components/exam/FinalExamClient';

export default function PreviewFinalExamClient() {
  const [answer, setAnswer] = useState('');

  return (
    <div className="h-dvh bg-background">
      <FinalExamClient
        examLayer="2"
        questionNum={1}
        timeRemaining={30}
        answer={answer}
        onAnswerChange={setAnswer}
        onSubmit={() => alert('Submitted: ' + answer)}
      />
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FinalExamClient from '@/components/exam/FinalExamClient';
import { toast } from 'sonner';

export default function PWExam() {
  const navigate = useNavigate();
  const [layer, setLayer] = useState<'1' | '2'>('1');
  const [questionNum, setQuestionNum] = useState(1);
  const [answer, setAnswer] = useState('');

  const handleSubmit = () => {
    toast.success(`Submitted: ${answer}`);
    setAnswer('');
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header for demonstration controls */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            ← Back
          </Button>
          <h1 className="font-pixel text-sm text-primary">PW EXAM DEMO</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Question</span>
            <select 
              value={questionNum} 
              onChange={(e) => setQuestionNum(Number(e.target.value))}
              className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"
            >
              {[1, 2, 3, 4].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <Tabs value={layer} onValueChange={(v) => setLayer(v as '1' | '2')}>
            <TabsList className="grid w-32 grid-cols-2 h-8">
              <TabsTrigger value="1" className="text-[10px] font-pixel">L1</TabsTrigger>
              <TabsTrigger value="2" className="text-[10px] font-pixel">L2</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* The Exam UI */}
      <div className="flex-1 overflow-hidden">
        <FinalExamClient
          examLayer={layer}
          questionNum={questionNum}
          timeRemaining={999} // Static high number for demo
          answer={answer}
          onAnswerChange={setAnswer}
          onSubmit={handleSubmit}
        />
      </div>

      <div className="p-4 bg-muted/30 text-center">
        <p className="text-[10px] font-mono text-muted-foreground">
          SOLO DEMO MODE: Switch layers to see how visual cryptography works.
        </p>
      </div>
    </div>
  );
}

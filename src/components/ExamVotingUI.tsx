import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { motion } from "framer-motion";

interface ExamVotingUIProps {
  submitterName: string;
  maskedAnswer: string;
  startedAt: number;
  votingDurationMs?: number;
  onVote: (vote: 'pass' | 'fail') => void;
  hasVoted?: boolean;
  currentVote?: 'pass' | 'fail' | null;
}

/**
 * Voting UI for Final Exam — shows submitter name, masked answer, countdown timer,
 * and vote buttons (Pass/Fail). Vote buttons disabled after voting or time expires.
 */
export const ExamVotingUI = ({
  submitterName,
  maskedAnswer,
  startedAt,
  votingDurationMs = 10000,
  onVote,
  hasVoted = false,
  currentVote = null,
}: ExamVotingUIProps) => {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.ceil((startedAt + votingDurationMs - Date.now()) / 1000)));
  const [isExpired, setIsExpired] = useState(timeLeft <= 0);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((startedAt + votingDurationMs - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setIsExpired(true);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt, votingDurationMs]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <div className="flex flex-col items-center gap-6 max-w-md w-full">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-mono mb-2">FINAL EXAM VOTING</p>
          <p className="text-sm font-pixel text-primary text-glow-green">{submitterName}'s Answer</p>
        </div>

        {/* Masked Answer Display */}
        <div className="flex justify-center gap-2 text-3xl font-pixel text-secondary tracking-widest">
          {maskedAnswer.split('').map((char, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="w-12 h-14 border-2 border-secondary rounded flex items-center justify-center"
            >
              {char}
            </motion.div>
          ))}
        </div>

        {/* Countdown Timer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-mono mb-1">Time remaining</p>
          <motion.p
            key={timeLeft}
            initial={{ scale: 1.2, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-5xl font-pixel text-accent"
          >
            {timeLeft}s
          </motion.p>
          {isExpired && (
            <p className="text-xs text-destructive font-mono mt-2">Time's up! Votes locked.</p>
          )}
        </div>

        {/* Vote Status */}
        {hasVoted && currentVote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`text-xs font-mono py-2 px-4 rounded border-2 ${
              currentVote === 'pass'
                ? 'border-primary text-primary'
                : 'border-destructive text-destructive'
            }`}
          >
            You voted: {currentVote === 'pass' ? '✓ PASS' : '✗ FAIL'}
          </motion.div>
        )}

        {/* Vote Buttons */}
        <div className="flex gap-4 w-full">
          <Button
            onClick={() => onVote('pass')}
            disabled={hasVoted || isExpired}
            variant={currentVote === 'pass' ? 'default' : 'outline'}
            className={`flex-1 h-16 font-pixel text-sm gap-2 ${
              currentVote === 'pass' ? 'bg-primary text-primary-foreground glow-green' : ''
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            PASS
          </Button>
          <Button
            onClick={() => onVote('fail')}
            disabled={hasVoted || isExpired}
            variant={currentVote === 'fail' ? 'destructive' : 'outline'}
            className={`flex-1 h-16 font-pixel text-sm gap-2 ${
              currentVote === 'fail' ? 'bg-destructive text-destructive-foreground' : ''
            }`}
          >
            <XCircle className="w-5 h-5" />
            FAIL
          </Button>
        </div>

        {/* Instructions */}
        {!hasVoted && !isExpired && (
          <p className="text-xs text-muted-foreground font-mono text-center">
            Vote PASS if the answer is correct, FAIL if incorrect
          </p>
        )}
      </div>
    </motion.div>
  );
};

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Send } from "lucide-react";

interface ExamSubmissionBoxProps {
  questionNum: number;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
  isSubmitting?: boolean;
  placeholder?: string;
}

/**
 * Exam submission input for the designated submitter during voting phase.
 * Shows question number, answer input, and submit button.
 */
export const ExamSubmissionBox = ({
  questionNum,
  onSubmit,
  disabled = false,
  isSubmitting = false,
  placeholder = "Type your answer…",
}: ExamSubmissionBoxProps) => {
  const [answer, setAnswer] = useState("");

  const handleSubmit = () => {
    if (answer.trim()) {
      onSubmit(answer.toUpperCase());
      setAnswer("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 p-4 border-2 border-secondary rounded-lg bg-background/50"
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="font-pixel text-secondary text-glow-purple">Q{questionNum}</span>
        <span className="text-xs text-muted-foreground">You are the submitter</span>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={answer}
          onChange={(e) => setAnswer(e.target.value.toUpperCase())}
          disabled={disabled || isSubmitting}
          className="flex-1 uppercase"
          onKeyDown={(e) => e.key === "Enter" && !disabled && handleSubmit()}
        />
        <Button
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || !answer.trim()}
          className="font-pixel text-xs gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground"
        >
          {isSubmitting ? "..." : <Send className="w-4 h-4" />}
          {isSubmitting ? "Submitting" : "Submit"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground font-mono text-center">
        Submit your answer. All chicks will vote after submission.
      </p>
    </motion.div>
  );
};

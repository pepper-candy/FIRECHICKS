export const MOCK_ANSWER_KEY: Record<number, string> = {
  1: "UST",
  2: "11M",
  3: "BIRD",
  4: "HALL",
};

export function normalizeMockExamAnswer(answer: string): string {
  return answer.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isMockExamAnswerCorrect(questionNum: number, answer: string): boolean {
  const submittedAnswer = normalizeMockExamAnswer(answer);
  const expectedAnswer = normalizeMockExamAnswer(MOCK_ANSWER_KEY[questionNum] ?? "");
  return submittedAnswer.length > 0 && submittedAnswer === expectedAnswer;
}

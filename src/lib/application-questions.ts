import applicationQuestions from "@/config/application-questions.json";

export type ApplicationQuestion = {
  id: string;
  section: 2 | 3 | 4 | 5;
  type?: "text" | "textarea" | "checkbox" | "radio" | "slider";
  label: string;
  placeholder?: string;
  required: boolean;
  rows?: number;
  options?: string[];
  min?: number;
  max?: number;
  showWhen?: {
    field: string;
    value: string;
  };
};

export type AnswerValue = string | string[];

export const questions = applicationQuestions as ApplicationQuestion[];

export function isQuestionVisible(
  question: ApplicationQuestion,
  answers: Record<string, AnswerValue>,
): boolean {
  if (!question.showWhen) {
    return true;
  }

  return answers[question.showWhen.field] === question.showWhen.value;
}

export function isQuestionFilled(
  question: ApplicationQuestion,
  value: AnswerValue | undefined,
): boolean {
  if (question.type === "checkbox") {
    return Array.isArray(value) && value.length > 0;
  }

  if (question.type === "slider") {
    if (typeof value !== "string" || value.trim().length === 0) {
      return false;
    }

    const numericValue = Number(value);
    const min = question.min ?? 1;
    const max = question.max ?? 10;

    return Number.isFinite(numericValue) && numericValue >= min && numericValue <= max;
  }

  return typeof value === "string" && value.trim().length > 0;
}

export function validateApplicationAnswers(
  answers: Record<string, AnswerValue>,
): string | null {
  for (const question of questions) {
    if (!question.required || !isQuestionVisible(question, answers)) {
      continue;
    }

    if (!isQuestionFilled(question, answers[question.id])) {
      return `Please answer: ${question.label}`;
    }
  }

  return null;
}

export function formatAnswerValue(value: AnswerValue | undefined): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "—";
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return "—";
}

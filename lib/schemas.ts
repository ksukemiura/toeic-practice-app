import { z } from "zod";

export function createOptionSchema() {
  return z.object({
    option: z.string().describe("Option text."),
    option_translation: z.string().describe("Simplified Chinese translation of the option text."),
    option_explanation: z.string().describe("Explanation in simplified Chinese of why this option is correct or incorrect. Explain in a way that even a primary school student can understand."),
  });
}

export function createQuestionSchema(numberOfOptions: number) {
  const optionSchema = createOptionSchema();

  return z.object({
    question: z.string().describe("Question text."),
    question_translation: z.string().describe("Simplified Chinese translation of the question text."),
    options: z.array(optionSchema).length(numberOfOptions),
    answer_index: z.number().int().min(0).max(numberOfOptions - 1),
    explanation: z.string().describe("Explanation in simplified Chinese. Explain in a way that even a primary school student can understand."),
  });
}

export function createQuizSchema(numberOfQuestions: number, numberOfOptions: number = 4) {
  const questionSchema = createQuestionSchema(numberOfOptions); 

  return z.object({
    quiz: z.array(questionSchema).length(numberOfQuestions),
  });
}

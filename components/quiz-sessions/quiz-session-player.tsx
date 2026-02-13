"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type QuizSessionOption = {
  id: string;
  option_index: number;
  option: string;
  option_translation: string;
  option_explanation: string;
};

export type QuizSessionQuestion = {
  id: string;
  question_index: number;
  question: string;
  question_translation: string;
  explanation: string;
  answer_index: number;
  options: QuizSessionOption[];
};

type QuizSessionPlayerProps = {
  sessionId: string;
  questions: QuizSessionQuestion[];
};

function formatOptionLabel(optionIndex: number): string {
  const normalized = Math.max(0, optionIndex);
  const alphabetIndex = normalized % 26;
  return `(${String.fromCharCode(65 + alphabetIndex)})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(value: unknown): string | null {
  if (!isRecord(value) || typeof value.error !== "string") {
    return null;
  }

  return value.error;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function QuizSessionPlayer({
  sessionId,
  questions,
}: QuizSessionPlayerProps) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<
    Record<string, string>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentQuestion = questions[currentQuestionIndex];

  if (!currentQuestion) {
    return <div className="p-6">No questions available for this session.</div>;
  }

  const selectedOptionId = selectedOptionIds[currentQuestion.id] ?? null;
  const selectedOption =
    currentQuestion.options.find((option) => option.id === selectedOptionId) ??
    null;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleSelectOption = (optionId: string) => {
    setErrorMessage(null);
    setSelectedOptionIds((previousValue) => ({
      ...previousValue,
      [currentQuestion.id]: optionId,
    }));
  };

  const handleNext = async () => {
    if (!selectedOptionId || isSubmitting) {
      return;
    }

    if (!isLastQuestion) {
      setCurrentQuestionIndex((previousIndex) => previousIndex + 1);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const selectedOptions = questions.map((question) => {
        const optionId =
          selectedOptionIds[question.id] ??
          (question.id === currentQuestion.id ? selectedOptionId : null);

        if (!optionId) {
          throw new Error("Please answer every question before finishing.");
        }

        return {
          questionId: question.id,
          optionId,
        };
      });

      const response = await fetch(
        `/api/quiz_sessions/${sessionId}/selected_options`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ selectedOptions }),
        },
      );
      const responseJson = await readJson(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(responseJson) ?? "Failed to save selected options.",
        );
      }

      router.replace(`/quiz_sessions/${sessionId}`);
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to save selected options.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            {currentQuestionIndex + 1} / {questions.length}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            {currentQuestion.question_index}. {currentQuestion.question}
          </p>

          <div className="space-y-2">
            {currentQuestion.options.map((option) => {
              const isSelected = option.id === selectedOptionId;
              const isCorrectOption =
                option.option_index === currentQuestion.answer_index;
              const hasSelection = selectedOption !== null;
              const selectedIsCorrect =
                selectedOption?.option_index === currentQuestion.answer_index;

              let optionClassName =
                "h-auto w-full justify-start whitespace-normal py-3 text-left";

              if (hasSelection) {
                if (isSelected && selectedIsCorrect) {
                  optionClassName +=
                    " border-green-600 bg-green-100 text-green-900 hover:bg-green-100";
                } else if (isSelected && !selectedIsCorrect) {
                  optionClassName +=
                    " border-destructive bg-destructive/15 text-destructive hover:bg-destructive/15";
                } else if (!isSelected && isCorrectOption && !selectedIsCorrect) {
                  optionClassName +=
                    " border-green-600 bg-green-100 text-green-900 hover:bg-green-100";
                }
              }

              return (
                <Button
                  key={option.id}
                  variant="outline"
                  className={optionClassName}
                  onClick={() => handleSelectOption(option.id)}
                >
                  {formatOptionLabel(option.option_index)} {option.option}
                </Button>
              );
            })}
          </div>

          {selectedOption ? (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">题目的翻译</p>
                <p className="text-sm text-muted-foreground">
                  {currentQuestion.question_translation}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">题目解析</p>
                <p className="text-sm text-muted-foreground">
                  {currentQuestion.explanation}
                </p>
              </div>

              <div className="space-y-2">
                <div className="space-y-2">
                  {currentQuestion.options.map((option) => (
                    <div key={option.id} className="rounded-md border p-3">
                      <p className="text-sm font-medium">
                        {formatOptionLabel(option.option_index)} {option.option}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        翻译: {option.option_translation}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        解析: {option.option_explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleNext}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {isLastQuestion
                  ? isSubmitting
                    ? "Saving answers..."
                    : "Finish Quiz"
                  : "Next Question"}
              </Button>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

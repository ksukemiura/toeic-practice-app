"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const DEFAULT_NUMBER_OF_QUESTIONS = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(value: unknown): string | null {
  if (!isRecord(value) || typeof value.error !== "string") {
    return null;
  }

  return value.error;
}

function getQuizId(value: unknown): string | null {
  if (!isRecord(value) || typeof value.quizId !== "string") {
    return null;
  }

  return value.quizId;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function GenerateQuizButton() {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerateQuiz = async () => {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const generateResponse = await fetch("/api/quizzes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          numberOfQuestions: DEFAULT_NUMBER_OF_QUESTIONS,
        }),
      });
      const generatedQuiz = await readJson(generateResponse);

      if (!generateResponse.ok) {
        throw new Error(
          getErrorMessage(generatedQuiz) ?? "Failed to generate quiz.",
        );
      }

      const saveResponse = await fetch("/api/quizzes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(generatedQuiz),
      });
      const savedQuiz = await readJson(saveResponse);

      if (!saveResponse.ok) {
        throw new Error(getErrorMessage(savedQuiz) ?? "Failed to save quiz.");
      }

      const quizId = getQuizId(savedQuiz);
      if (!quizId) {
        throw new Error("Quiz ID was not returned.");
      }

      router.push(`/quizzes/${quizId}`);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to create quiz.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col items-start gap-2">
      <Button onClick={handleGenerateQuiz} disabled={isGenerating}>
        {isGenerating ? "Generating quiz..." : "Generate New Quiz"}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

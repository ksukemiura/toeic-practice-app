"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type StartQuizSessionButtonProps = {
  quizId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(value: unknown): string | null {
  if (!isRecord(value) || typeof value.error !== "string") {
    return null;
  }

  return value.error;
}

function getSessionId(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.session)) {
    return null;
  }

  return typeof value.session.id === "string" ? value.session.id : null;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function StartQuizSessionButton({ quizId }: StartQuizSessionButtonProps) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleStartSession = async () => {
    setIsStarting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/quiz_sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ quizId }),
      });
      const responseJson = await readJson(response);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(responseJson) ?? "Failed to start quiz session.",
        );
      }

      const sessionId = getSessionId(responseJson);

      if (!sessionId) {
        throw new Error("Session ID was not returned.");
      }

      router.push(`/quiz_sessions/${sessionId}`);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to start quiz session.");
      }
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col items-start gap-2">
      <Button onClick={handleStartSession} disabled={isStarting}>
        {isStarting ? "Starting quiz..." : "Start New Attempt"}
      </Button>
      {errorMessage ? (
        <p className="text-sm text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}

import { Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Database } from "@/database.types";
import { createClient } from "@/lib/supabase/server";
import { StartQuizSessionButton } from "@/components/quizzes/start-quiz-session-button";
import Link from "next/link";

type QuizOption = {
  id: string;
  option_index: number;
  option: string;
};

type QuizQuestion = {
  id: string;
  question_index: number;
  question: string;
  options: QuizOption[];
};

type QuizDetail = {
  questions: QuizQuestion[];
};

type GetQuizArgs = Database["public"]["Functions"]["get_quiz"]["Args"];

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function formatOptionLabel(optionIndex: number): string {
  const normalized = Math.max(0, optionIndex);
  const alphabetIndex = normalized % 26;
  return `(${String.fromCharCode(65 + alphabetIndex)})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeOption(value: unknown): QuizOption | null {
  if (!isRecord(value)) {
    return null;
  }

  const optionIndex = parseNumber(value.option_index);
  const optionText = value.option;
  const optionId = parseString(value.id);

  if (
    optionIndex === null ||
    typeof optionText !== "string" ||
    optionId === null
  ) {
    return null;
  }

  return {
    id: optionId,
    option_index: optionIndex,
    option: optionText,
  };
}

function normalizeQuestion(value: unknown): QuizQuestion | null {
  if (!isRecord(value)) {
    return null;
  }

  const questionIndex = parseNumber(value.question_index);
  const questionText = value.question;
  const optionsValue = value.options;
  const questionId = parseString(value.id);

  if (
    questionIndex === null ||
    typeof questionText !== "string" ||
    !Array.isArray(optionsValue) ||
    questionId === null
  ) {
    return null;
  }

  const options = optionsValue
    .map(normalizeOption)
    .filter((option): option is QuizOption => option !== null)
    .sort((a, b) => a.option_index - b.option_index);

  return {
    id: questionId,
    question_index: questionIndex,
    question: questionText,
    options,
  };
}

function normalizeQuizDetail(value: unknown): QuizDetail | null {
  if (!isRecord(value) || !Array.isArray(value.questions)) {
    return null;
  }

  const questions = value.questions
    .map(normalizeQuestion)
    .filter((question): question is QuizQuestion => question !== null)
    .sort((a, b) => a.question_index - b.question_index);

  return { questions };
}

async function QuizDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id) {
    return <div className="p-6 text-destructive">Missing quiz id.</div>;
  }

  const supabase = await createClient();
  const rpcArgs: GetQuizArgs = { p_quiz_id: id };
  const { data, error } = await supabase.rpc("get_quiz", rpcArgs);

  if (error) {
    return <div className="p-6 text-destructive">Failed to load quiz detail.</div>;
  }

  const quizDetail = normalizeQuizDetail(data);

  if (!quizDetail || quizDetail.questions.length === 0) {
    return <div className="p-6">No questions found.</div>;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href="/quizzes">Quizzes</Link>
        </Button>
      </div>
      {quizDetail.questions.map((question) => (
        <Card key={question.id}>
          <CardContent className="space-y-3 pt-6">
            <p>
              {question.question_index}. {question.question}
            </p>
            <div className="space-y-2">
              {question.options.map((option) => (
                <div key={option.id}>
                  <p>
                    {formatOptionLabel(option.option_index)} {option.option}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        <StartQuizSessionButton quizId={id} />
      </div>
    </main>
  );
}

export default function QuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-6">Loading quiz detail...</div>}>
      <QuizDetailContent params={params} />
    </Suspense>
  );
}

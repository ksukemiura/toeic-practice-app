import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Database } from "@/database.types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

type QuizSession = Pick<
  Database["public"]["Tables"]["quiz_sessions"]["Row"],
  "id" | "created_at" | "score" | "total_questions"
>;

type SelectedOption = Pick<
  Database["public"]["Tables"]["selected_options"]["Row"],
  "quiz_session_id" | "question_id" | "option_id"
>;

type QuestionAnswer = Pick<
  Database["public"]["Tables"]["questions"]["Row"],
  "id" | "answer_index"
>;

type OptionIndex = Pick<
  Database["public"]["Tables"]["options"]["Row"],
  "id" | "option_index"
>;

type FallbackSessionScore = {
  score: number;
  totalQuestions: number;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

async function QuizSessionsContent() {
  const supabase = await createClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getClaims();

  if (authError || !authData?.claims?.sub) {
    redirect("/auth/login");
  }

  const { data, error } = await supabase
    .from("quiz_sessions")
    .select("id, created_at, score, total_questions")
    .eq("user_id", authData.claims.sub)
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-6 text-destructive">Failed to load sessions.</div>;
  }

  const sessions = (data ?? []) as QuizSession[];
  const fallbackScoreBySessionId = new Map<string, FallbackSessionScore>();

  const sessionsMissingScore = sessions.filter((session) => session.score === null);

  if (sessionsMissingScore.length > 0) {
    const sessionIds = sessionsMissingScore.map((session) => session.id);
    const { data: selectedOptionsData, error: selectedOptionsError } =
      await supabase
        .from("selected_options")
        .select("quiz_session_id, question_id, option_id")
        .in("quiz_session_id", sessionIds);

    if (!selectedOptionsError) {
      const selectedOptions = (selectedOptionsData ?? []) as SelectedOption[];
      const questionIds = Array.from(
        new Set(selectedOptions.map((selectedOption) => selectedOption.question_id)),
      );
      const optionIds = Array.from(
        new Set(selectedOptions.map((selectedOption) => selectedOption.option_id)),
      );

      const [{ data: questionsData, error: questionsError }, { data: optionsData, error: optionsError }] =
        await Promise.all([
          questionIds.length > 0
            ? supabase
                .from("questions")
                .select("id, answer_index")
                .in("id", questionIds)
            : Promise.resolve({ data: [], error: null }),
          optionIds.length > 0
            ? supabase
                .from("options")
                .select("id, option_index")
                .in("id", optionIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (!questionsError && !optionsError) {
        const questionAnswerById = new Map<string, number>(
          ((questionsData ?? []) as QuestionAnswer[]).map((question) => [
            question.id,
            question.answer_index,
          ]),
        );
        const optionIndexById = new Map<string, number>(
          ((optionsData ?? []) as OptionIndex[]).map((option) => [
            option.id,
            option.option_index,
          ]),
        );
        const selectedOptionsBySessionId = new Map<string, SelectedOption[]>();

        selectedOptions.forEach((selectedOption) => {
          const existing =
            selectedOptionsBySessionId.get(selectedOption.quiz_session_id) ?? [];
          existing.push(selectedOption);
          selectedOptionsBySessionId.set(selectedOption.quiz_session_id, existing);
        });

        sessionsMissingScore.forEach((session) => {
          const rows = selectedOptionsBySessionId.get(session.id) ?? [];
          const totalQuestions = session.total_questions;

          if (
            typeof totalQuestions !== "number" ||
            !Number.isFinite(totalQuestions) ||
            totalQuestions <= 0 ||
            rows.length !== totalQuestions
          ) {
            return;
          }

          const score = rows.reduce((accumulator, row) => {
            const answerIndex = questionAnswerById.get(row.question_id);
            const selectedOptionIndex = optionIndexById.get(row.option_id);
            return typeof answerIndex === "number" &&
              typeof selectedOptionIndex === "number" &&
              answerIndex === selectedOptionIndex
              ? accumulator + 1
              : accumulator;
          }, 0);

          fallbackScoreBySessionId.set(session.id, {
            score,
            totalQuestions,
          });
        });
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quiz Attempts</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/quizzes">Quizzes</Link>
        </Button>
      </div>
      {sessions.length === 0 ? (
        <div>No quiz sessions found.</div>
      ) : (
        sessions.map((session) => {
          const fallbackScore = fallbackScoreBySessionId.get(session.id);

          return (
            <Link
              key={session.id}
              href={`/quiz_sessions/${session.id}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="space-y-1 pt-6">
                  <p>Attempted at {formatDate(session.created_at)}</p>
                  <p className="text-sm text-muted-foreground">
                    Score:{" "}
                    {session.score !== null && session.total_questions !== null
                      ? `${session.score} / ${session.total_questions}`
                      : fallbackScore
                        ? `${fallbackScore.score} / ${fallbackScore.totalQuestions}`
                        : "Not graded yet"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })
      )}
    </main>
  );
}

export default function QuizSessionsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading quiz sessions...</div>}>
      <QuizSessionsContent />
    </Suspense>
  );
}

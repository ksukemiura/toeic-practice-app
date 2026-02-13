import { Suspense } from "react";
import type { Database } from "@/database.types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GenerateQuizButton } from "@/components/quizzes/generate-quiz-button";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Quiz = Database["public"]["Tables"]["quizzes"]["Row"];
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
type QuizWithQuestions = Pick<Quiz, "id" | "created_at"> & {
  questions: Array<{ id: string }> | null;
  quiz_sessions: QuizSession[] | null;
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

async function QuizzesContent() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select(
      "id, created_at, questions(id), quiz_sessions(id, created_at, score, total_questions)",
    )
    .order("created_at", { ascending: false });

  const quizzes = (data ?? []) as QuizWithQuestions[];
  const fallbackScoreBySessionId = new Map<string, FallbackSessionScore>();
  const sessions = quizzes.flatMap((quiz) => quiz.quiz_sessions ?? []);
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
        <h1 className="text-2xl font-bold">Quizzes</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/quiz_sessions">Quiz Attempts</Link>
        </Button>
      </div>
      {error ? (
        <div className="text-destructive">Failed to load quizzes.</div>
      ) : quizzes.length === 0 ? (
        <div>No quizzes found.</div>
      ) : (
        quizzes.map((quiz) => (
          <Link key={quiz.id} href={`/quizzes/${quiz.id}`} className="block">
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="space-y-1 pt-6">
                <p>Created at {formatDate(quiz.created_at)}</p>
                <p>{quiz.questions?.length ?? 0} questions</p>
                {quiz.quiz_sessions && quiz.quiz_sessions.length > 0 ? (
                  quiz.quiz_sessions
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(b.created_at).getTime() -
                        new Date(a.created_at).getTime(),
                    )
                    .map((session) => {
                      const fallbackScore = fallbackScoreBySessionId.get(
                        session.id,
                      );

                      return (
                        <p
                          key={session.id}
                          className="text-sm text-muted-foreground"
                        >
                          Attempt at {formatDate(session.created_at)} Score:{" "}
                          {session.score !== null &&
                          session.total_questions !== null
                            ? `${session.score}/${session.total_questions}`
                            : fallbackScore
                              ? `${fallbackScore.score}/${fallbackScore.totalQuestions}`
                              : "Not graded yet"}
                        </p>
                      );
                    })
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No attempts yet
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))
      )}
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        <GenerateQuizButton />
      </div>
    </main>
  );
}

export default function QuizzesPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading quizzes...</div>}>
      <QuizzesContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Database } from "@/database.types";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuizSessionPlayer } from "@/components/quiz-sessions/quiz-session-player";
import { StartQuizSessionButton } from "@/components/quizzes/start-quiz-session-button";

type QuestionRow = Pick<
  Database["public"]["Tables"]["questions"]["Row"],
  | "id"
  | "question_index"
  | "question"
  | "question_translation"
  | "explanation"
  | "answer_index"
>;

type OptionRow = Pick<
  Database["public"]["Tables"]["options"]["Row"],
  | "id"
  | "question_id"
  | "option_index"
  | "option"
  | "option_translation"
  | "option_explanation"
>;

type SelectedOptionRow = Pick<
  Database["public"]["Tables"]["selected_options"]["Row"],
  "question_id" | "option_id"
>;

type QuizQuestionForPlayer = {
  id: string;
  question_index: number;
  question: string;
  question_translation: string;
  explanation: string;
  answer_index: number;
  options: {
    id: string;
    option_index: number;
    option: string;
    option_translation: string;
    option_explanation: string;
  }[];
};

function formatOptionLabel(optionIndex: number): string {
  const normalized = Math.max(0, optionIndex);
  const alphabetIndex = normalized % 26;
  return `(${String.fromCharCode(65 + alphabetIndex)})`;
}

function buildQuizQuestions(
  questions: QuestionRow[],
  options: OptionRow[],
): QuizQuestionForPlayer[] {
  const optionsByQuestionId = new Map<string, QuizQuestionForPlayer["options"]>();

  options.forEach((option) => {
    const existingOptions = optionsByQuestionId.get(option.question_id) ?? [];
    existingOptions.push({
      id: option.id,
      option_index: option.option_index,
      option: option.option,
      option_translation: option.option_translation,
      option_explanation: option.option_explanation,
    });
    optionsByQuestionId.set(option.question_id, existingOptions);
  });

  return questions
    .map((question) => ({
      id: question.id,
      question_index: question.question_index,
      question: question.question,
      question_translation: question.question_translation,
      explanation: question.explanation,
      answer_index: question.answer_index,
      options: (optionsByQuestionId.get(question.id) ?? []).sort(
        (a, b) => a.option_index - b.option_index,
      ),
    }))
    .sort((a, b) => a.question_index - b.question_index);
}

function QuizSessionResult({
  quizId,
  questions,
  selectedOptionByQuestionId,
}: {
  quizId: string;
  questions: QuizQuestionForPlayer[];
  selectedOptionByQuestionId: Map<string, string>;
}) {
  const results = questions.map((question) => {
    const selectedOptionId = selectedOptionByQuestionId.get(question.id) ?? null;
    const selectedOption =
      question.options.find((option) => option.id === selectedOptionId) ?? null;
    const correctOption =
      question.options.find(
        (option) => option.option_index === question.answer_index,
      ) ?? null;
    const isCorrect =
      selectedOption !== null &&
      correctOption !== null &&
      selectedOption.id === correctOption.id;

    return {
      question,
      selectedOption,
      correctOption,
      isCorrect,
    };
  });

  const score = results.filter((result) => result.isCorrect).length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quiz Attempt</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/quiz_sessions">Quiz Attempts</Link>
        </Button>
      </div>
      <p className="text-lg font-semibold">
        Score: {score} / {questions.length}
      </p>

      {results.map(({ question, selectedOption, correctOption, isCorrect }) => (
        <Card
          key={question.id}
          className={
            isCorrect
              ? "border-green-600 bg-green-100"
              : "border-destructive bg-destructive/15"
          }
        >
          <CardContent className="space-y-2 pt-6">
            {/* <p className="text-sm font-semibold text-muted-foreground">
              Question {question.question_index}
            </p> */}
            <p>{question.question_index}. {question.question}</p>
            <p className="text-sm text-muted-foreground">
              Correct answer:{" "}
              {correctOption
                ? `${formatOptionLabel(correctOption.option_index)} ${correctOption.option}`
                : "Unknown"}
            </p>
            <p className="text-sm text-muted-foreground">
              Your answer:{" "}
              {selectedOption
                ? `${formatOptionLabel(selectedOption.option_index)} ${selectedOption.option}`
                : "No answer"}
            </p>
          </CardContent>
        </Card>
      ))}
      <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        <StartQuizSessionButton quizId={quizId} />
      </div>
    </main>
  );
}

async function QuizSessionContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!id) {
    return <div className="p-6 text-destructive">Missing quiz session id.</div>;
  }

  const supabase = await createClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getClaims();

  if (authError || !authData?.claims?.sub) {
    redirect("/auth/login");
  }

  const { data: quizSession, error: quizSessionError } = await supabase
    .from("quiz_sessions")
    .select("id, quiz_id")
    .eq("id", id)
    .eq("user_id", authData.claims.sub)
    .maybeSingle();

  if (quizSessionError) {
    return (
      <div className="p-6 text-destructive">Failed to load quiz session.</div>
    );
  }

  if (!quizSession) {
    return <div className="p-6">Quiz session not found.</div>;
  }

  const { data: questionsData, error: questionsError } = await supabase
    .from("questions")
    .select(
      "id, question_index, question, question_translation, explanation, answer_index",
    )
    .eq("quiz_id", quizSession.quiz_id)
    .order("question_index", { ascending: true });

  if (questionsError) {
    return <div className="p-6 text-destructive">Failed to load questions.</div>;
  }

  const questions = (questionsData ?? []) as QuestionRow[];

  if (questions.length === 0) {
    return <div className="p-6">No questions found for this quiz session.</div>;
  }

  const questionIds = questions.map((question) => question.id);

  const { data: optionsData, error: optionsError } = await supabase
    .from("options")
    .select(
      "id, question_id, option_index, option, option_translation, option_explanation",
    )
    .in("question_id", questionIds)
    .order("option_index", { ascending: true });

  if (optionsError) {
    return <div className="p-6 text-destructive">Failed to load options.</div>;
  }

  const { data: selectedOptionsData, error: selectedOptionsError } =
    await supabase
      .from("selected_options")
      .select("question_id, option_id")
      .eq("quiz_session_id", quizSession.id);

  if (selectedOptionsError) {
    return (
      <div className="p-6 text-destructive">
        Failed to load selected options.
      </div>
    );
  }

  const quizQuestions = buildQuizQuestions(
    questions,
    (optionsData ?? []) as OptionRow[],
  );

  const selectedOptionByQuestionId = new Map<string, string>(
    ((selectedOptionsData ?? []) as SelectedOptionRow[]).map((selectedOption) => [
      selectedOption.question_id,
      selectedOption.option_id,
    ]),
  );

  const hasSubmittedAnswers =
    selectedOptionByQuestionId.size === quizQuestions.length &&
    quizQuestions.length > 0;

  if (hasSubmittedAnswers) {
    return (
      <QuizSessionResult
        quizId={quizSession.quiz_id}
        questions={quizQuestions}
        selectedOptionByQuestionId={selectedOptionByQuestionId}
      />
    );
  }

  return (
    <QuizSessionPlayer
      sessionId={quizSession.id}
      questions={quizQuestions.map(
        ({
          id: questionId,
          question_index,
          question,
          question_translation,
          explanation,
          answer_index,
          options,
        }) => ({
          id: questionId,
          question_index,
          question,
          question_translation,
          explanation,
          answer_index,
          options,
        }),
      )}
    />
  );
}

export default function QuizSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="p-6">Loading quiz session...</div>}>
      <QuizSessionContent params={params} />
    </Suspense>
  );
}

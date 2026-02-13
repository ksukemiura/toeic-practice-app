import {
  NextRequest,
  NextResponse,
} from "next/server";
import { z } from "zod";
import type { Database } from "@/database.types";
import { createClient } from "@/lib/supabase/server";

type SelectedOption = Database["public"]["Tables"]["selected_options"]["Row"];

const selectedOptionSchema = z.object({
  questionId: z.string().min(1, "questionId is required."),
  optionId: z.string().min(1, "optionId is required."),
});

const saveSelectedOptionsSchema = z.object({
  selectedOptions: z.array(selectedOptionSchema),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session ID in route parameters." },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = saveSelectedOptionsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
      { status: 400 },
    );
  }

  const { selectedOptions } = parsed.data;

  const questionIds = selectedOptions.map(({ questionId }) => questionId);
  const uniqueQuestionIds = Array.from(new Set(questionIds));

  if (uniqueQuestionIds.length !== questionIds.length) {
    return NextResponse.json(
      { error: "Each question can only have one selected option." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getClaims();

  if (authError || !authData?.claims?.sub) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  const userId = authData.claims.sub;

  const { data: quizSession, error: sessionError } = await supabase
    .from("quiz_sessions")
    .select("id, quiz_id, total_questions")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json(
      { error: "Failed to verify quiz session." },
      { status: 500 },
    );
  }

  if (!quizSession) {
    return NextResponse.json(
      { error: "Quiz session not found." },
      { status: 404 },
    );
  }

  let computedScore = 0;

  if (uniqueQuestionIds.length > 0) {
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("id, answer_index")
      .eq("quiz_id", quizSession.quiz_id)
      .in("id", uniqueQuestionIds);

    if (questionsError) {
      return NextResponse.json(
        { error: "Failed to validate questions." },
        { status: 500 },
      );
    }

    if ((questions ?? []).length !== uniqueQuestionIds.length) {
      return NextResponse.json(
        { error: "One or more questions do not belong to this quiz session." },
        { status: 400 },
      );
    }

    const uniqueOptionIds = Array.from(
      new Set(selectedOptions.map(({ optionId }) => optionId)),
    );

    const { data: options, error: optionsError } = await supabase
      .from("options")
      .select("id, question_id, option_index")
      .in("id", uniqueOptionIds)
      .in("question_id", uniqueQuestionIds);

    if (optionsError) {
      return NextResponse.json(
        { error: "Failed to validate options." },
        { status: 500 },
      );
    }

    if ((options ?? []).length !== uniqueOptionIds.length) {
      return NextResponse.json(
        { error: "One or more options do not match the provided questions." },
        { status: 400 },
      );
    }

    const optionQuestionMap = new Map(
      (options ?? []).map((option) => [option.id, option.question_id]),
    );

    const hasMismatchedOption = selectedOptions.some(
      ({ questionId, optionId }) => optionQuestionMap.get(optionId) !== questionId,
    );

    if (hasMismatchedOption) {
      return NextResponse.json(
        { error: "One or more options do not belong to their provided question." },
        { status: 400 },
      );
    }

    const questionAnswerMap = new Map(
      (questions ?? []).map((question) => [question.id, question.answer_index]),
    );
    const optionIndexMap = new Map(
      (options ?? []).map((option) => [option.id, option.option_index]),
    );

    computedScore = selectedOptions.reduce((score, selectedOption) => {
      const answerIndex = questionAnswerMap.get(selectedOption.questionId);
      const selectedOptionIndex = optionIndexMap.get(selectedOption.optionId);

      if (
        typeof answerIndex === "number" &&
        typeof selectedOptionIndex === "number" &&
        answerIndex === selectedOptionIndex
      ) {
        return score + 1;
      }

      return score;
    }, 0);
  }

  const { error: deleteError } = await supabase
    .from("selected_options")
    .delete()
    .eq("quiz_session_id", quizSession.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to reset selected options for this session." },
      { status: 500 },
    );
  }

  if (selectedOptions.length === 0) {
    const { error: scoreResetError } = await supabase
      .from("quiz_sessions")
      .update({ score: null })
      .eq("id", quizSession.id);

    if (scoreResetError) {
      return NextResponse.json(
        { error: "Failed to reset quiz session score." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        selectedOptions: [] as SelectedOption[],
      },
      { status: 200 },
    );
  }

  const rowsToInsert = selectedOptions.map(({ questionId, optionId }) => ({
    quiz_session_id: quizSession.id,
    question_id: questionId,
    option_id: optionId,
  }));

  const { data: savedSelectedOptions, error: insertError } = await supabase
    .from("selected_options")
    .insert(rowsToInsert)
    .select("*");

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to save selected options." },
      { status: 500 },
    );
  }

  const sessionTotalQuestions =
    typeof quizSession.total_questions === "number" &&
    Number.isFinite(quizSession.total_questions)
      ? quizSession.total_questions
      : uniqueQuestionIds.length;

  const { error: scoreUpdateError } = await supabase
    .from("quiz_sessions")
    .update({
      score: computedScore,
      total_questions: sessionTotalQuestions,
    })
    .eq("id", quizSession.id);

  if (scoreUpdateError) {
    return NextResponse.json(
      { error: "Failed to update quiz session score." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      selectedOptions: (savedSelectedOptions ?? []) as SelectedOption[],
    },
    { status: 200 },
  );
}

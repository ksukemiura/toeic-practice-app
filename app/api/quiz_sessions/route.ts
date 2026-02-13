import {
  NextRequest,
  NextResponse,
} from "next/server";
import { z } from "zod";
import type { Database } from "@/database.types";
import { createClient } from "@/lib/supabase/server";

type QuizSession = Database["public"]["Tables"]["quiz_sessions"]["Row"];

const createQuizSessionSchema = z.object({
  quizId: z.string().min(1, "quizId is required."),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = createQuizSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
      { status: 400 },
    );
  }

  const { quizId } = parsed.data;
  const supabase = await createClient();

  const {
    data,
    error: authError,
  } = await supabase.auth.getClaims();

  if (authError || !data?.claims?.sub) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 },
    );
  }

  const claims = data.claims;

  const { data: quiz, error: quizError } = await supabase
    .from("quizzes")
    .select("id")
    .eq("id", quizId)
    .maybeSingle();

  if (quizError) {
    return NextResponse.json(
      { error: "Failed to verify quiz." },
      { status: 500 },
    );
  }

  if (!quiz) {
    return NextResponse.json(
      { error: "Quiz not found." },
      { status: 404 },
    );
  }

  const { count: questionCount, error: countError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("quiz_id", quizId);

  if (countError) {
    return NextResponse.json(
      { error: "Failed to prepare quiz session." },
      { status: 500 },
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("quiz_sessions")
    .insert({
      quiz_id: quizId,
      user_id: claims.sub,
      total_questions: questionCount ?? 0,
    })
    .select("*")
    .single();

  if (sessionError) {
    return NextResponse.json(
      { error: "Failed to create quiz session." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      session: session as QuizSession,
    },
    { status: 201 },
  );
}

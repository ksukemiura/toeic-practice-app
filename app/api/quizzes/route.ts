import {
  NextRequest,
  NextResponse,
} from "next/server";
import type { Database } from "@/database.types";
import { createClient } from "@/lib/supabase/server";

type QuizMetadata = Database["public"]["Tables"]["quizzes"]["Row"];
type SaveQuizArgs = Database["public"]["Functions"]["save_quiz"]["Args"];
type SaveQuizReturn = Database["public"]["Functions"]["save_quiz"]["Returns"];

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch quizzes." },
      { status: 500 },
    );
  }

  return NextResponse.json(data as QuizMetadata[], { status: 200 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const supabase = await createClient();
    const rpcArgs: SaveQuizArgs = {
      p_questions: body,
    };

    const { data: quizId, error } = await supabase.rpc("save_quiz", rpcArgs);

    if (error) {
      return NextResponse.json(
        { error: "Failed to save quiz." },
        { status: 500 },
      );
    }

    if (!quizId) {
      return NextResponse.json(
        { error: "Quiz ID was not returned." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        quizId: quizId as SaveQuizReturn,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }
}

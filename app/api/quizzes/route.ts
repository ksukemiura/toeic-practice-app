import {
  NextRequest,
  NextResponse,
} from "next/server";
import type { Database } from "@/database.types";
import { createClient } from "@/lib/supabase/server";

type GetQuizArgs = Database["public"]["Functions"]["get_quiz"]["Args"];
type GetQuizReturn = Database["public"]["Functions"]["get_quiz"]["Returns"];
type SaveQuizArgs = Database["public"]["Functions"]["save_quiz"]["Args"];
type SaveQuizReturn = Database["public"]["Functions"]["save_quiz"]["Returns"];

export async function GET(request: NextRequest): Promise<NextResponse> {
  const quizId = request.nextUrl.searchParams.get("id");

  if (!quizId) {
    return NextResponse.json(
      { error: "Missing quizId query parameter." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const rpcArgs: GetQuizArgs = { p_quiz_id: quizId };
  const { data, error } = await supabase.rpc("get_quiz", rpcArgs);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch quiz." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Quiz not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(data as GetQuizReturn, { status: 200 });
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

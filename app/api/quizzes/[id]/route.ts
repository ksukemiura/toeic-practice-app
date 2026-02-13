import { NextResponse } from "next/server";
import type { Database } from "@/database.types";
import { createClient } from "@/lib/supabase/server";

type GetQuizArgs = Database["public"]["Functions"]["get_quiz"]["Args"];
type GetQuizReturn = Database["public"]["Functions"]["get_quiz"]["Returns"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Missing quiz ID in route parameters." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const rpcArgs: GetQuizArgs = { p_quiz_id: id };
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

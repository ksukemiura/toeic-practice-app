import {
  NextRequest,
  NextResponse,
} from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { createQuizSchema } from "@/lib/schemas";


const requestSchema = z.object({
  numberOfQuestions: z.number().int().min(1).max(30),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsedBody = requestSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { errors: parsedBody.error },
        { status: 400 }
      );
    }

    const { numberOfQuestions } = parsedBody.data;
    const quizSchema = createQuizSchema(numberOfQuestions);
    const openai = new OpenAI();

    const response = await openai.responses.parse({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "You are a professional TOEIC test developer.",
        },
        {
          role: "user",
          content: "Generate TOEIC Part 5 questions.",
        },
      ],
      text: {
        format: zodTextFormat(quizSchema, "toeic_quiz"),
      },
    });

    if (!response.output_parsed) {
      return NextResponse.json(
        { error: "Failed to parse quiz response from model." },
        { status: 502 }
      );
    }

    return NextResponse.json(response.output_parsed.quiz);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to generate quiz." },
      { status: 500 }
    );
  }
}

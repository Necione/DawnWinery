import { NextResponse } from "next/server";
import {
  validateApplicationAnswers,
  type AnswerValue,
} from "@/lib/application-questions";
import { applicationsConfig } from "@/config/applications";
import { getVerifiedDiscordUser } from "@/lib/discord-auth";
import { getDiscordBotToken, postApplicationToDiscord } from "@/lib/discord-bot";
import { getUserStatsByDiscordId } from "@/lib/mongodb";

type SubmitApplicationBody = {
  answers?: Record<string, AnswerValue>;
};

export async function POST(request: Request) {
  if (!applicationsConfig.open) {
    return NextResponse.json(
      { error: "Applications are currently closed." },
      { status: 403 },
    );
  }

  if (!getDiscordBotToken()) {
    return NextResponse.json(
      { error: "Application submissions are not configured yet." },
      { status: 503 },
    );
  }

  const discordUser = await getVerifiedDiscordUser();

  if (!discordUser) {
    return NextResponse.json(
      { error: "Verify your Discord account before submitting." },
      { status: 401 },
    );
  }

  let body: SubmitApplicationBody;

  try {
    body = (await request.json()) as SubmitApplicationBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const answers = body.answers;

  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "Missing application answers." }, { status: 400 });
  }

  const validationError = validateApplicationAnswers(answers);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const serverStats = await getUserStatsByDiscordId(discordUser.id);

  try {
    await postApplicationToDiscord({
      channelId: applicationsConfig.discordChannelId,
      user: discordUser,
      answers,
      serverStats,
    });
  } catch (error) {
    console.error("Failed to post application to Discord:", error);
    return NextResponse.json(
      { error: "Failed to submit your application. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}

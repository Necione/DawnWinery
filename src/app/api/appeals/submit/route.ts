import { NextResponse } from "next/server";
import {
  buildBanAppealRecord,
  getAppealUserContext,
  saveBanAppeal,
  validateAppealReason,
} from "@/lib/appeals";
import { appealsConfig } from "@/config/appeals";
import { getVerifiedDiscordUser } from "@/lib/discord-auth";
import { getDiscordBotToken, postAppealToDiscord } from "@/lib/discord-bot";
import {
  getClientIp,
  getClientRequestMetadata,
} from "@/lib/request-client";

type SubmitAppealBody = {
  reason?: string;
};

export async function POST(request: Request) {
  if (!appealsConfig.open) {
    return NextResponse.json(
      { error: "Ban appeals are currently closed." },
      { status: 403 },
    );
  }

  if (!getDiscordBotToken()) {
    return NextResponse.json(
      { error: "Appeal submissions are not configured yet." },
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

  let body: SubmitAppealBody;

  try {
    body = (await request.json()) as SubmitAppealBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const validationError = validateAppealReason(
    body.reason,
    appealsConfig.minReasonLength,
    appealsConfig.maxReasonLength,
  );

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const reason = (body.reason as string).trim();
  const clientIp = getClientIp(request);
  const requestMetadata = getClientRequestMetadata(request);
  const context = await getAppealUserContext(discordUser.id);

  let discordResult: { messageId: string; threadId: string };

  try {
    discordResult = await postAppealToDiscord({
      channelId: appealsConfig.discordChannelId,
      user: discordUser,
      reason,
      serverStats: context.serverStats,
      clientIp,
    });
  } catch (error) {
    console.error("Failed to post appeal to Discord:", error);
    return NextResponse.json(
      { error: "Failed to submit your appeal. Please try again." },
      { status: 502 },
    );
  }

  const saved = await saveBanAppeal(
    buildBanAppealRecord({
      user: discordUser,
      reason,
      clientIp,
      request: requestMetadata,
      context,
      discordMessageId: discordResult.messageId,
      discordThreadId: discordResult.threadId,
    }),
  );

  if (!saved) {
    console.error("Appeal posted to Discord but failed to save to MongoDB.", {
      discordId: discordUser.id,
      messageId: discordResult.messageId,
    });
  }

  return NextResponse.json({ success: true });
}

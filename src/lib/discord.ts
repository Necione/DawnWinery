export type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

export function getDiscordAvatarUrl(user: DiscordUser) {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
  }

  const index = Number(BigInt(user.id) >> BigInt(22)) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function getDiscordDisplayName(user: DiscordUser) {
  return user.global_name ?? user.username;
}

export function getDiscordConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

export function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

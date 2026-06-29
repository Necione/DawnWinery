# Dawn Winery

A simple landing page for the [Dawn Winery](https://discord.gg/dawnwinery) Discord server.

## Getting started

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | Yes | Discord OAuth application client ID |
| `DISCORD_CLIENT_SECRET` | Yes | Discord OAuth application client secret |
| `DISCORD_BOT_TOKEN` | Yes | Bot token for invites and application notifications |
| `DISCORD_INVITE_CHANNEL_ID` | Yes | Channel ID used to create invite links |
| `MONGODB_URI` | Yes | MongoDB connection string for application storage |
| `NEXT_PUBLIC_FB_PIXEL_ID` | No | Facebook Pixel ID for client-side tracking |
| `FB_CONVERSIONS_API_ACCESS_TOKEN` | No | Facebook Conversions API access token |
| `FB_TEST_EVENT_CODE` | No | Facebook test event code (development only) |

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run start` — run the production server

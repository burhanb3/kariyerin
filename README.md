# Octodive

Octodive is a polished underwater arcade game for IEEE MSKU KARİYER-IN events. Players guide a stylish octopus mascot through coral, jellyfish, mines, rock arches, seaweed, and floating debris while collecting pearls and ink shields for bonus points.

## Features

- Phaser + TypeScript + Vite browser game
- Keyboard, mouse, and touch input
- Gradually increasing speed, obstacle pressure, and pattern difficulty
- Pearls, combo scoring, ink shield, and current zones
- DOM-based start, pause, game over, and leaderboard screens
- Supabase leaderboard with all-time and daily views
- Local fallback leaderboard when Supabase is not configured
- Image-generated PNG mascot and game pickups/obstacles adapted into a cohesive arcade style
- Image-generated gameplay sprites, crisp canvas water-line details, ambient bubbles, and WebAudio sound effects

## Local Setup

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

The production build is written to `dist/`.

## Test

```bash
npm test
```

The tests cover the pure gameplay systems for difficulty, scoring, combo behavior, and local leaderboard sorting/filtering.

## Environment

Copy `.env.example` to `.env.local`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
EVENT_ID=kariyer-in-2026-05-07
EVENT_ADMIN_CODE=choose-a-strong-event-admin-code
VITE_CLUB_NAME=IEEE MSKÜ Student Branch
VITE_EVENT_LABEL=KARİYER-IN Etkinliği
```

If the server API is unavailable, Octodive still runs and stores leaderboard entries in the current browser as a local fallback. Do not expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_*` variable.

## Supabase Setup

Create or migrate the `octodash_scores` table with `docs/supabase-event-security.sql`. The legacy table name is intentionally preserved so existing deployments and scores keep working. The important event behavior is:

- `score_status` is one of `valid`, `suspicious`, `disqualified`, or `deleted`.
- Public leaderboard responses only include `valid` scores.
- Admin actions are soft updates; hard deletes are not used for event moderation.
- IP data is derived server-side and stored only as `masked_ip`.
- Direct anon inserts should remain disabled; score writes go through Vercel Functions with `SUPABASE_SERVICE_ROLE_KEY`.

Run the SQL from the Supabase SQL editor, then set the server-side env vars in Vercel.

## Admin Panel

Open `/admin` on the deployed site and enter `EVENT_ADMIN_CODE`. The admin panel shows all score statuses, masked IP, user agent, client/run IDs, same-client score count, and moderation actions:

- Geçerli yap
- Şüpheli işaretle
- Diskalifiye et
- Silindi olarak işaretle

The participant-facing leaderboard never renders IP, user agent, client ID, run ID, admin notes, or non-valid scores.

## Deployment Notes

Any static host that supports Vite works:

```bash
npm run build
```

Deploy to Vercel for the event-safe serverless API. Use `npm run build`, output `dist`, and set the server-side Supabase/admin env vars in the Vercel dashboard.

For event use, print or display a QR code to the deployed URL. The first screen is already participant-friendly and opens directly into the game menu.

## Project Structure

```text
src/
  main.ts                       Vite entry point and Phaser boot
  style.css                     Responsive game UI styling
  game/
    audio/AudioManager.ts       WebAudio sound effects and mute state
    render/createTextures.ts    Original runtime-generated obstacle/background assets and fallback textures
    scenes/PlayScene.ts         Phaser gameplay scene
    services/leaderboard.ts     Supabase REST client and local fallback
    systems/difficulty.ts       Difficulty curve
    systems/scoring.ts          Distance, pearl, and combo scoring
    ui/GameUi.ts                DOM screens, HUD, leaderboard, forms
tests/                          Node test runner specs for pure systems
```

## Controls

- Space, click, or tap: swim upward
- P: pause
- HUD buttons: pause and mute

## Asset Policy

Octodive does not use copyrighted third-party game art. The playable/menu mascot uses `public/assets/octodash-mascot.png`, an original image-generated PNG-style game illustration adapted from the club-provided reference character with the visor, headphones, shirt, pouch, blue body, and pink suction-cup details.

The jellyfish, sea mine, seaweed, coral branch, floating trash bottle, pearl, ink power-up, shield bubble, ambient fish, distant reef layer, bubble sprite, rock pillar, and seafloor reef clusters use original generated PNG assets in `public/assets/`. The key gameplay sprites are `jellyfish.png`, `sea-mine.png`, `seaweed.png`, `coral-branch.png`, `trash-bottle.png`, `pearl.png`, `ink-drop.png`, `shield-bubble.png`, `ambient-fish.png`, `distant-reef.png`, `bubble-soft.png`, `rock-pillar.png`, and `reef-sprout.png`.

The start, pause, game-over, and leaderboard screens are deterministic HTML/CSS interfaces layered over the game, so labels and controls stay sharp on event displays and mobile screens. Current zones, water-line overlays, and fallback textures are generated from canvas drawing code in `src/game/render/createTextures.ts`. The `*-source.png` files in `public/assets/` are kept as processed source references and are not loaded by the game.

To regenerate the transparent mascot assets from the local reference files:

```bash
python scripts/process-mascot-assets.py
```

# Friendly Bot - Telegram Group Friend Bot

A fun Telegram bot that acts like a friend in group chats, not an assistant. Uses XiaomiMiMo LLM for responses.

## Features

- **Mention-only mode**: Bot only responds when @mentioned or replied to
- **5 Personalities**: chill_friend, deadpan_judge, chaotic_gremlin, helpful_nerd, group_elder
- **Roast levels**: 0-3 (from supportive to savage)
- **Group memory**: Save inside jokes and group lore
- **Commands**: /recap, /judge, /vibe, /remember, /lore, /personality, /roast
- **Safety filter**: Blocks harmful content and personal attacks
- **Rate limiting**: 3 replies per minute per user

## Setup

### 1. Install Deno

```bash
curl -fsSL https://deno.land/install.sh | sh
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run `supabase/migrations/001_initial.sql`
4. Get your project URL and service role key from Settings > API

### 3. Configure Environment

Create `.env` file:

```env
BOT_TOKEN=your_telegram_bot_token
BOT_USERNAME=NekoBot
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MIMO_API_BASE=https://api.xiaomimimo.com/v1
MIMO_API_KEY=your-mimo-api-key
MIMO_MODEL=mimo-v2.5-pro
MAX_CONTEXT_MESSAGES=50
RATE_LIMIT_PER_MINUTE=3
MESSAGE_TTL_HOURS=168
DEFAULT_PERSONALITY=chill_friend
DEFAULT_ROAST_LEVEL=1
```

### 4. Run Locally (Polling Mode)

```bash
deno task dev
```

### 5. Deploy to Supabase Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy
supabase functions deploy telegram-bot --no-verify-jwt

# Set secrets
supabase secrets set BOT_TOKEN=your_token BOT_USERNAME=NekoBot SUPABASE_URL=... MIMO_API_KEY=...

# Set webhook
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -d "url=https://your-project-ref.supabase.co/functions/v1/telegram-bot/webhook"
```

## Commands

- `/start` - Show help
- `/help` - List all commands
- `/personality [name]` - Change bot personality
- `/roast [0-3]` - Set roast level
- `/remember [fact]` - Save group memory
- `/lore` - View group memories
- `/recap` - Get today's group summary
- `/judge` - Judge a discussion (reply to message)
- `/vibe` - Check group mood

## Architecture

```
src/
├── bot.ts              # Main bot setup
├── config.ts           # Configuration
├── db/
│   └── supabase.ts     # Database layer
├── handlers/
│   ├── commands.ts     # Command handlers
│   ├── mention.ts      # Mention handler
│   ├── middleware.ts   # Message caching
│   └── reply.ts        # Reply handler
└── services/
    ├── cache.ts        # In-memory cache
    ├── llm.ts          # MiMo API
    ├── prompt.ts       # Prompt builder
    └── safety.ts       # Safety filter
```

## License

MIT

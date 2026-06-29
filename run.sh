#!/bin/bash
export PATH="$HOME/.deno/bin:$PATH"
export $(grep -v '^#' .env | xargs)
exec deno run --allow-net --allow-env --allow-read --allow-write --allow-import src/bot.ts

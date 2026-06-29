#!/bin/bash
export PATH="$HOME/.deno/bin:$PATH"
export $(grep -v '^#' .env | xargs)
exec deno task serve

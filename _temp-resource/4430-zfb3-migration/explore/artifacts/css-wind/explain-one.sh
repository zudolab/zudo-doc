#!/bin/bash
cd "$(dirname "$0")/zfb3/probe"
out=$(../node_modules/.bin/zfb wind explain -- "$1" 2>&1)
oc=$(printf '%s\n' "$out" | sed -n 's/^outcome: //p' | head -1)
dg=$(printf '%s\n' "$out" | sed -n 's/^diagnostic: //p' | head -1 | sed -E 's/ at zudo-wind:[^:]*:[0-9]+:/:/')
printf '%s\t%s\t%s\n' "$1" "$oc" "$dg"

#!/usr/bin/env bash

set -euo pipefail

: "${DEPLOY_URL:?DEPLOY_URL is required}"

MAX_ATTEMPTS="${CSS_FETCH_ATTEMPTS:-11}"
RETRY_DELAY_SECONDS="${CSS_FETCH_RETRY_DELAY_SECONDS:-6}"
CSS_OUTPUT_PATH="${CSS_OUTPUT_PATH:-${RUNNER_TEMP:-/tmp}/deployed-css.css}"

# Retry the complete HTML -> referenced CSS transaction. Retrying a CSS URL
# captured once can pin the gate to a deployment generation whose hashed asset
# has already rotated away (#3321). Eleven attempts with at most ten 6-second
# sleeps preserve the previous ~60-second propagation allowance without nested
# curl retries or a blanket delay on healthy deploys.
FETCHED_CSS=false
LAST_FAILURE="not attempted"
LAST_CSS_PATH=""

for ((ATTEMPT = 1; ATTEMPT <= MAX_ATTEMPTS; ATTEMPT += 1)); do
  HTML=""
  CSS_PATH=""

  if ! HTML=$(curl -fsSL "$DEPLOY_URL/"); then
    LAST_FAILURE="homepage fetch failed: $DEPLOY_URL/"
    echo "CSS-shape fetch attempt $ATTEMPT/$MAX_ATTEMPTS: $LAST_FAILURE"
  else
    # Use a here-string (not echo|grep) so head -1 exiting early cannot SIGPIPE
    # an upstream echo and flip pipefail. The conditional makes grep's no-match
    # status retryable instead of letting `set -e` abort the gate.
    CSS_PATH=$(grep -oE "href=[\"']?[^\"' >]*assets/styles-[^\"' >]*\.css" <<<"$HTML" | head -1 | sed -E "s/^href=[\"']?//") || true

    if [ -z "$CSS_PATH" ]; then
      # ${#HTML} is a diagnostic character count, not a byte count.
      LAST_FAILURE="no CSS link found in $DEPLOY_URL/ (fetched ${#HTML} chars)"
      echo "CSS-shape fetch attempt $ATTEMPT/$MAX_ATTEMPTS: $LAST_FAILURE"
    else
      LAST_CSS_PATH="$CSS_PATH"
      if curl -fsSL "${DEPLOY_URL}${CSS_PATH}" -o "$CSS_OUTPUT_PATH"; then
        FETCHED_CSS=true
        break
      fi
      LAST_FAILURE="stylesheet fetch failed: ${DEPLOY_URL}${CSS_PATH}"
      echo "CSS-shape fetch attempt $ATTEMPT/$MAX_ATTEMPTS: $LAST_FAILURE"
    fi
  fi

  if [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; then
    sleep "$RETRY_DELAY_SECONDS"
  fi
done

if [ "$FETCHED_CSS" != true ]; then
  if [ -n "$LAST_CSS_PATH" ]; then
    echo "::error::failed to fetch coherent deployed CSS after $MAX_ATTEMPTS attempts; last failure: $LAST_FAILURE; last stylesheet path: $LAST_CSS_PATH"
  else
    echo "::error::failed to fetch coherent deployed CSS after $MAX_ATTEMPTS attempts; last failure: $LAST_FAILURE"
  fi
  exit 1
fi

CSS_BYTES=$(wc -c < "$CSS_OUTPUT_PATH")
MIN_CSS_BYTES=50000  # post-zfb#159 split-import fix (in pin 9239267) drops leaked Tailwind defaults; healthy baseline ~64-66 KB (down from pre-fix ~77.7 KB). Threshold sits well above the ~30-40 KB broken-scanner floor with headroom for future intentional shrinkage.
[ "$CSS_BYTES" -ge "$MIN_CSS_BYTES" ] || { echo "::error::deployed CSS is $CSS_BYTES bytes, below threshold $MIN_CSS_BYTES (broken scanner produces ~30-40 KB)"; exit 1; }

MEDIA_COUNT=$(grep -cE '^@media' "$CSS_OUTPUT_PATH" || true)
MIN_MEDIA=3  # tuned from the Sub-2 manager-confirm baseline (post-fix has 4 @media; threshold 3 leaves one block of safety)
[ "$MEDIA_COUNT" -ge "$MIN_MEDIA" ] || { echo "::error::deployed CSS has $MEDIA_COUNT @media blocks, below threshold $MIN_MEDIA"; exit 1; }

LEAKED_DEFAULT_COLORS=$(grep -cE -- '--color-(gray|zinc|red|amber|green|cyan|blue|indigo|purple|slate)-[0-9]+:' "$CSS_OUTPUT_PATH" || true)
MAX_DEFAULT_THEME_COLOR_TOKENS=2  # tuned from the Sub-2 manager-confirm baseline (post-fix has 0; broken state has 36)
[ "$LEAKED_DEFAULT_COLORS" -le "$MAX_DEFAULT_THEME_COLOR_TOKENS" ] || { echo "::error::deployed CSS has $LEAKED_DEFAULT_COLORS leaked Tailwind default color tokens, above threshold $MAX_DEFAULT_THEME_COLOR_TOKENS (zfb user_has_import blind-spot regression)"; exit 1; }

echo "OK: deployed CSS is $CSS_BYTES bytes, $MEDIA_COUNT @media blocks, $LEAKED_DEFAULT_COLORS leaked default color tokens"

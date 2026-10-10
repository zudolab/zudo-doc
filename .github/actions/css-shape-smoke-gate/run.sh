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
# #4470: exact repaired f1c3d727 site measurement: 230494 bytes, 87 @media
# occurrences (86 start a line). See permanent v4.2.1-gates.md. These floors
# retain headroom while detecting a missing package scan/import; neither is lowered.
MIN_CSS_BYTES=180000
[ "$CSS_BYTES" -ge "$MIN_CSS_BYTES" ] || { echo "::error::deployed CSS is $CSS_BYTES bytes, below threshold $MIN_CSS_BYTES"; exit 1; }

# Count occurrences, not lines: one minified line can contain many media rules.
MEDIA_COUNT=$( (grep -oE '@media[[:space:](]' "$CSS_OUTPUT_PATH" || true) | wc -l)
MIN_MEDIA=65
[ "$MEDIA_COUNT" -ge "$MIN_MEDIA" ] || { echo "::error::deployed CSS has $MEDIA_COUNT @media blocks, below threshold $MIN_MEDIA"; exit 1; }

# Owned Wind output must carry the reset/token layers and emitted responsive
# package utilities. Palette tokens alone do not establish scanner coverage.
for REQUIRED in '@layer zw-reset' '@layer zw-tokens' '--color-bg:' '.lg\:block' '.xl\:flex'; do
  grep -Fq -- "$REQUIRED" "$CSS_OUTPUT_PATH" || { echo "::error::deployed CSS is missing owned Wind contract $REQUIRED"; exit 1; }
done
if grep -Eq '@(theme|source)[[:space:](]|\.(bg|text)-red-500([[:space:]{:,]|$)' "$CSS_OUTPUT_PATH"; then
  echo "::error::deployed CSS contains retired Tailwind directives or unsupported palette utilities"
  exit 1
fi

echo "OK: deployed CSS is $CSS_BYTES bytes, $MEDIA_COUNT @media blocks, owned Wind reset/tokens and responsive utilities present"

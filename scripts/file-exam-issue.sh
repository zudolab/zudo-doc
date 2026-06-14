#!/usr/bin/env bash
# file-exam-issue.sh — Deduped failure issue reporter for exam.yml.
#
# One-open-tracking-issue-per-workflow dedup strategy:
#   - Checks for an existing open issue with label `exam-failure`
#   - If found: posts a comment with the run URL and failing spec names
#   - If not found: creates a new issue
#
# Usage:
#   bash scripts/file-exam-issue.sh \
#     [--report <path-to-playwright-json-report>] \
#     --run-url <github-actions-run-url> \
#     --workflow <workflow-job-name>
#
# Environment:
#   GITHUB_TOKEN  — required; gh CLI uses this for auth
#   GH_REPO       — optional; defaults to current repo (gh detects from git remote)

set -euo pipefail

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
REPORT_PATH=""
RUN_URL=""
WORKFLOW=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --report)
      REPORT_PATH="$2"
      shift 2
      ;;
    --run-url)
      RUN_URL="$2"
      shift 2
      ;;
    --workflow)
      WORKFLOW="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$RUN_URL" ]]; then
  echo "Error: --run-url is required" >&2
  exit 1
fi

if [[ -z "$WORKFLOW" ]]; then
  WORKFLOW="Nightly Exam"
fi

# ---------------------------------------------------------------------------
# Ensure the exam-failure label exists (idempotent)
# ---------------------------------------------------------------------------
echo "Ensuring label 'exam-failure' exists..."
gh label create "exam-failure" \
  --description "Automated failure report from exam.yml nightly workflow" \
  --color "D93F0B" \
  2>/dev/null || true
echo "Label ready."

# ---------------------------------------------------------------------------
# Parse failing spec names from JSON report (if provided)
# ---------------------------------------------------------------------------
FAILING_SPECS=""
if [[ -n "$REPORT_PATH" && -f "$REPORT_PATH" ]]; then
  echo "Parsing failing specs from $REPORT_PATH..."
  # Extract test titles from failed tests using node (no jq dependency required).
  # Playwright JSON report structure: { suites: [ { suites: [ { specs: [ { ok, title } ] } ] } ] }
  FAILING_SPECS=$(node --eval "
    const fs = require('fs');
    const report = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const titles = new Set();
    function walk(obj) {
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) { obj.forEach(walk); }
        else {
          if ('ok' in obj && 'title' in obj && obj.ok === false) titles.add(obj.title);
          for (const v of Object.values(obj)) walk(v);
        }
      }
    }
    walk(report);
    if (titles.size) process.stdout.write([...titles].join('\n') + '\n');
  " -- "$REPORT_PATH" 2>/dev/null || true)
fi

# ---------------------------------------------------------------------------
# Build issue/comment body
# ---------------------------------------------------------------------------
build_body() {
  local body
  body="## Exam failure: ${WORKFLOW}"$'\n'$'\n'
  body+="**Run:** ${RUN_URL}"$'\n'$'\n'

  if [[ -n "$FAILING_SPECS" ]]; then
    body+="### Failing tests"$'\n'$'\n'
    while IFS= read -r spec; do
      body+="- ${spec}"$'\n'
    done <<< "$FAILING_SPECS"
  else
    body+="_No JSON report available — check the run URL for details._"$'\n'
  fi

  echo "$body"
}

BODY=$(build_body)

# ---------------------------------------------------------------------------
# Dedup: comment on existing open issue, else create new
# ---------------------------------------------------------------------------
echo "Checking for open exam-failure issues..."

# Build gh --repo flag if GH_REPO is set (falls back to git remote auto-detect)
REPO_FLAG=()
if [[ -n "${GH_REPO:-}" ]]; then
  REPO_FLAG=(--repo "$GH_REPO")
fi

EXISTING_ISSUE=$(gh issue list \
  "${REPO_FLAG[@]}" \
  --label "exam-failure" \
  --state open \
  --json number \
  --jq '.[0].number' \
  2>/dev/null || true)

if [[ -n "$EXISTING_ISSUE" ]]; then
  echo "Found open issue #${EXISTING_ISSUE} — posting comment..."
  gh issue comment "$EXISTING_ISSUE" "${REPO_FLAG[@]}" --body "$BODY"
  echo "Comment posted to issue #${EXISTING_ISSUE}"
else
  echo "No open exam-failure issue found — creating new issue..."
  TITLE="[exam] Nightly suite failure: ${WORKFLOW}"
  gh issue create \
    "${REPO_FLAG[@]}" \
    --title "$TITLE" \
    --label "exam-failure" \
    --body "$BODY"
  echo "Issue created."
fi

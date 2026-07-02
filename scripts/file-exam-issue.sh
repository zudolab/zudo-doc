#!/usr/bin/env bash
# file-exam-issue.sh — Deduped failure issue reporter for exam.yml.
#
# Per-workflow dedup strategy (zudolab/zudo-doc#2535):
#   - Three exam jobs (e2e-full / slow-create / slow-zudo-doc) share the
#     `exam-failure` label, so label-only lookup previously matched
#     `.[0]` of ANY open exam-failure issue — an e2e-full failure could
#     append onto an unrelated slow-create issue that happened to be older.
#   - Dedup now also matches on the issue TITLE, which embeds the workflow
#     identity (`[exam] Nightly suite failure: <workflow>`), so each job's
#     open issue is scoped to that job.
#
# Modes:
#   (default) — failure mode. Posts a comment to the open issue scoped to
#     this workflow, or creates a new one if none is open.
#   --green   — closes the open issue scoped to this workflow with a
#     green-run comment. No-op (not an error) if none is open.
#
# Usage:
#   bash scripts/file-exam-issue.sh \
#     [--report <path-to-playwright-json-report>] \
#     --run-url <github-actions-run-url> \
#     --workflow <workflow-job-name> \
#     [--green]
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
GREEN=0

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
    --green)
      GREEN=1
      shift
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

ISSUE_TITLE="[exam] Nightly suite failure: ${WORKFLOW}"

# Build gh --repo flag if GH_REPO is set (falls back to git remote auto-detect)
REPO_FLAG=()
if [[ -n "${GH_REPO:-}" ]]; then
  REPO_FLAG=(--repo "$GH_REPO")
fi

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
# Build issue/comment bodies
# ---------------------------------------------------------------------------
build_failure_body() {
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

build_green_body() {
  local body
  body="## Exam green run: ${WORKFLOW}"$'\n'$'\n'
  body+="**Run:** ${RUN_URL}"$'\n'$'\n'
  body+="All tests passed — closing this tracking issue."$'\n'
  echo "$body"
}

# ---------------------------------------------------------------------------
# Dedup lookup: find the open issue (if any) scoped to THIS workflow —
# matches both the `exam-failure` label and the exact issue title (which
# embeds the workflow identity). Title matching is done in node rather than
# `gh --jq` so the workflow name never has to be safely embedded in a jq
# expression string.
# ---------------------------------------------------------------------------
find_existing_issue() {
  # --limit: gh defaults to a 30-issue page; there are only 3 exam jobs so
  # this is defensive rather than a live risk, but matches the fix applied
  # to the retry-flake lookup in scripts/report-retry-flakes.mjs.
  gh issue list \
    "${REPO_FLAG[@]}" \
    --label "exam-failure" \
    --state open \
    --json number,title \
    --limit 100 \
    2>/dev/null \
    | node --eval "
        const chunks = [];
        process.stdin.on('data', (c) => chunks.push(c));
        process.stdin.on('end', () => {
          const wantTitle = process.argv[1];
          let issues = [];
          try { issues = JSON.parse(Buffer.concat(chunks).toString('utf8') || '[]'); } catch { issues = []; }
          const match = issues.find((i) => i.title === wantTitle);
          if (match) process.stdout.write(String(match.number));
        });
      " -- "$ISSUE_TITLE" \
    || true
}

EXISTING_ISSUE=$(find_existing_issue)

# ---------------------------------------------------------------------------
# --green mode: close the scoped issue if one is open; no-op otherwise.
# ---------------------------------------------------------------------------
if [[ "$GREEN" -eq 1 ]]; then
  if [[ -n "$EXISTING_ISSUE" ]]; then
    echo "Found open issue #${EXISTING_ISSUE} for workflow \"${WORKFLOW}\" — closing with a green-run comment..."
    gh issue close "$EXISTING_ISSUE" "${REPO_FLAG[@]}" \
      --comment "$(build_green_body)" \
      --reason "completed"
    echo "Issue #${EXISTING_ISSUE} closed."
  else
    echo "No open exam-failure issue for workflow \"${WORKFLOW}\" — nothing to close."
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Failure mode: comment on the scoped open issue, else create a new one.
# ---------------------------------------------------------------------------
echo "Ensuring label 'exam-failure' exists..."
gh label create "exam-failure" \
  --description "Automated failure report from exam.yml nightly workflow" \
  --color "D93F0B" \
  2>/dev/null || true
echo "Label ready."

BODY=$(build_failure_body)

if [[ -n "$EXISTING_ISSUE" ]]; then
  echo "Found open issue #${EXISTING_ISSUE} for workflow \"${WORKFLOW}\" — posting comment..."
  gh issue comment "$EXISTING_ISSUE" "${REPO_FLAG[@]}" --body "$BODY"
  echo "Comment posted to issue #${EXISTING_ISSUE}"
else
  echo "No open exam-failure issue for workflow \"${WORKFLOW}\" — creating new issue..."
  gh issue create \
    "${REPO_FLAG[@]}" \
    --title "$ISSUE_TITLE" \
    --label "exam-failure" \
    --body "$BODY"
  echo "Issue created."
fi

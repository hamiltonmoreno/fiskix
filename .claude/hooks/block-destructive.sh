#!/bin/bash
# Hook: Block destructive Bash commands
# Triggered by: PreToolUse (matcher: Bash)
# Claude Code passes tool input as JSON on stdin

COMMAND=$(python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('command', ''))
except:
    print('')
")

DESTRUCTIVE_PATTERNS=(
  "rm -rf"
  "DROP TABLE"
  "DROP DATABASE"
  "git reset --hard"
  "git push --force"
  "git push -f"
  "git clean -f"
  "git branch -D"
  "truncate"
)

for pattern in "${DESTRUCTIVE_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qi "$pattern"; then
    echo "BLOCKED: Destructive pattern detected — '$pattern'"
    echo "Command: $COMMAND"
    echo "Confirm manually if this is intentional."
    exit 2
  fi
done

exit 0

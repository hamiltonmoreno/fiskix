#!/bin/bash
# Hook: Run lint + typecheck before git commit
# Triggered by: PreToolUse (matcher: Bash)
# Only activates when command contains "git commit"

COMMAND=$(python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('tool_input', {}).get('command', ''))
except:
    print('')
")

if ! echo "$COMMAND" | grep -q "git commit"; then
  exit 0
fi

echo "Pre-commit: running lint + typecheck..."
cd /Users/hamiltonvicente/Documents/fiskix || exit 1

npm run lint --silent 2>&1
if [ $? -ne 0 ]; then
  echo "BLOCKED: Lint errors detected. Fix before committing."
  exit 2
fi

npm run type-check --silent 2>&1
if [ $? -ne 0 ]; then
  echo "BLOCKED: TypeScript errors detected. Fix before committing."
  exit 2
fi

echo "Pre-commit checks passed."
exit 0

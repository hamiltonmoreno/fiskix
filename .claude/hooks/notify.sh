#!/bin/bash
# Hook: macOS notification when Claude session ends
# Triggered by: Stop event
# stdin contains session summary JSON (ignored here)

MESSAGE="Sessão Claude Code concluída — Fiskix"

if command -v osascript &> /dev/null; then
  osascript -e "display notification \"$MESSAGE\" with title \"Claude Code\" sound name \"Glass\""
fi

exit 0

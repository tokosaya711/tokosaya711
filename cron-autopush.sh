#!/bin/bash
cd /home/z/my-project
UNPUSHED=$(git cherry origin/main 2>/dev/null | wc -l)
if [ "$UNPUSHED" -gt 0 ]; then
  git push origin main 2>&1
fi

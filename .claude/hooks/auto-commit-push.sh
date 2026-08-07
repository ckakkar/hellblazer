#!/usr/bin/env bash
# Stop-hook safety net: commit anything left in the tree, then push.
#
# Claude is expected to make its own properly-described commits during a turn;
# this only catches what it forgot and makes sure nothing sits unpushed. A
# commit written here is a sweep, so it says so rather than pretending to
# describe the work.
#
# Bails out silently on anything ambiguous: not a repo, detached HEAD, or a
# rebase/merge in flight. Never fails the turn.

d="${CLAUDE_PROJECT_DIR:-$PWD}"
cd "$d" 2>/dev/null || exit 0

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Detached HEAD: nothing sensible to push to.
branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null) || exit 0
[ -n "$branch" ] || exit 0

# Mid-rebase / mid-merge: committing here would corrupt the operation.
for p in rebase-merge rebase-apply MERGE_HEAD CHERRY_PICK_HEAD; do
  if [ -e "$(git rev-parse --git-path "$p" 2>/dev/null)" ]; then
    exit 0
  fi
done

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  git add -A 2>/dev/null
  git commit -q -m "Sweep uncommitted changes from the last turn" 2>/dev/null
fi

# No upstream, or nothing ahead of it? Done.
git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1 || exit 0
if [ -z "$(git log --oneline '@{u}..HEAD' 2>/dev/null)" ]; then
  exit 0
fi

if ! git push -q origin "$branch" 2>/dev/null; then
  printf '{"systemMessage":"Auto-push to %s failed (diverged or offline). Commits are local; push manually."}\n' "$branch"
fi
exit 0

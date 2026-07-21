---
description: Commit changes then release dev → prod (fast-forward), MinJob git ritual
---

Ship the current changes following the MinJob git workflow. Steps:

1. Run `git status` + `git branch --show-current`. **Only proceed on `dev`** — if on another branch, stop and ask.
2. Review the diff. Stage the relevant files. If **both code and docs** changed and they are logically separable, make **two commits** (code first, then docs) — matching the project's established pattern.
3. Commit with a clear **English** message, verb-first (Add/Fix/Update/Remove), one logical change per commit. If the user passed a message in `$ARGUMENTS`, use it as the subject; otherwise write one from the diff. End every commit message with:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
4. `git push origin dev`
5. `git branch -f prod dev` then `git push origin prod` — **fast-forward only, never a merge commit**.
6. Confirm with `git log --oneline -3 prod` that dev and prod point at the new commit.

Never force-push a shared branch. Never commit `.env` or secrets. If nothing is staged and nothing obvious to stage, ask what to ship.

$ARGUMENTS

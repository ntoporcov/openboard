---
description: Push current branch to GitHub
---

Push the current branch and current committed changes to GitHub.

Process:

1. Run `git status --short --branch` to understand the branch and worktree state.
2. If there are uncommitted changes, stop and tell me they need to be committed first. Do not commit unless I explicitly asked for that too.
3. If the branch has no upstream, push with `git push -u origin HEAD`.
4. If the branch has an upstream, push with `git push`.
5. If the push is rejected or blocked by hooks, report the exact reason and the next required action.

Safety rules:

- Do not force push.
- Do not amend commits.
- Do not run destructive git commands.
- Do not skip hooks with `--no-verify`.
- Do not push to a remote other than `origin` unless I explicitly ask.

$ARGUMENTS

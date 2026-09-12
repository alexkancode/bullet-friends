---
name: deploy-bullet-friends
description: Deploy Bullet Friends to production end to end - gate, push, wait for CI and Pages, stamped Railway server deploy, then automatic verification. Code-first - run the bundled script and trust its exit code.
---

# Deploy Bullet Friends

Run the bundled script from the repository root:

```bash
node .claude/skills/deploy-bullet-friends/deploy.mjs
```

The pipeline it executes, stopping at the first failure:

1. Refuses a dirty working tree or a branch other than main.
2. Runs the full local gate: lint, typecheck, tests, build.
3. Pushes to origin main.
4. Polls the CI run for HEAD until it concludes (Pages deploys in that run).
5. Sets `COMMIT_SHA` on the Railway service and runs `railway up`.
6. Polls the production health endpoint until it reports HEAD.
7. Chains into `deploy-bullet-friends-verification` for the final verdict.
8. Runs `scripts/smoke.sh` against production (HTTP and WebSocket happy and
   unhappy paths).

Exit 0 means production is verifiably running HEAD and passes smoke. Do not hand-roll these
steps separately; this script is the deploy path.

---
name: deploy-bullet-friends-verification
description: Verify whether the latest commit is fully deployed to Bullet Friends production (GitHub Pages client and Railway server). Code-first - run the bundled script and trust its exit code.
---

# Deploy Verification

Run the bundled script from the repository root:

```bash
node .claude/skills/deploy-bullet-friends-verification/verify.mjs
```

The script prints one PASS/FAIL line per check and exits 0 only when the
live client and server both report the exact commit at local HEAD:

1. HEAD matches origin/main (nothing unpushed).
2. The CI run for HEAD concluded successfully.
3. The live page at https://alexkancode.github.io/bullet-friends/ embeds
   HEAD in its commit meta tag.
4. The live server at https://bullet-friends-production.up.railway.app
   reports HEAD from /health.

Do not re-derive these checks by hand; the script is the source of truth.
On failure it names the stale target and prints the remediation command.
A stale server usually means a manual deploy is needed:

```bash
railway variables --service bullet-friends --set "COMMIT_SHA=$(git rev-parse HEAD)"
railway up --service bullet-friends --detach
```

Or run the companion skill `deploy-bullet-friends` to ship and verify in
one motion.

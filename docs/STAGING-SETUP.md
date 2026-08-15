# Staging Environment — One-Time Setup

## Overview
- **Production**: bounceops.online → `main` branch → GitHub Pages
- **Staging**: bounceops.info → `staging` branch → Vercel (auto-deploys on every push to `staging`)
- **Supabase**: Same project for both (prod data, read via anon key)
- **Your responsibility**: Everything up to opening a PR from `staging` → `main`

---

## Step 1 — Get repo access
- Accept the GitHub collaborator invite to `Scalability-Vamsee/vehicle-parts-check`
- Clone the repo:
  ```
  git clone https://github.com/Scalability-Vamsee/vehicle-parts-check.git
  cd vehicle-parts-check
  ```

## Step 2 — Install Claude Code
- Download from https://claude.ai/download
- Run `claude` inside the repo folder
- It reads `CLAUDE.md` automatically — this gives full project context

## Step 3 — Vercel (already set up — nothing to do)
- Vercel project `vehicle-parts-check` is already connected to `Scalability-Vamsee/vehicle-parts-check`
- Production branch in Vercel = `staging` — every push to `staging` auto-deploys to bounceops.info
- bounceops.info DNS is already pointed at Vercel
- You don't need to set up anything here — just push to `staging` and check bounceops.info

## Step 4 — Supabase access
- The Supabase anon key is already in the repo — your Claude Code uses it to read tables and understand the schema
- You do NOT need a Supabase account invite
- You cannot run migrations or touch edge functions — write migration `.sql` files and commit them; Vamsee's Claude applies them via MCP

## Step 5 — Branch protection (Vamsee sets this)
- `main` — no direct push, PR required
- `staging` — you can push directly or via PR from feature branches

---

## Your workflow for every task

```
1. Pull latest staging
   git checkout staging && git pull origin staging

2. Create feature branch
   git checkout -b feature/your-task-name

3. Do the work (Claude Code helps here)

4. Push feature branch
   git push origin feature/your-task-name

5. Open PR → staging on GitHub
   Test passes? Merge it yourself.

6. Netlify auto-deploys to bounceops.info
   Test thoroughly on bounceops.info

7. Open PR from staging → main on GitHub
   Fill in the PR template carefully — Vamsee's Claude reads it
   to decide what to apply before merging to prod

8. Notify Vamsee — he pastes the PR URL to his Claude session
   Claude reviews, applies any migrations, runs the push
```

---

## Rules

- **Never push directly to `main`** — branch protection blocks this anyway
- **Always test on bounceops.info before opening staging → main PR**
- **DB migrations**: write the `.sql` file in `supabase/migrations/`, commit it with your PR. Vamsee's Claude applies it to prod via MCP.
- **Edge functions**: write the function, commit it. Vamsee's Claude deploys it via MCP. Do not attempt to deploy yourself.
- **Secrets**: never put PATs, service role keys, or passwords in any file. Anon key is fine (it's public).
- **JS syntax**: Claude Code checks this automatically. Don't push broken JS.
- **One task per PR** — small focused PRs are easier to review and safer to promote.

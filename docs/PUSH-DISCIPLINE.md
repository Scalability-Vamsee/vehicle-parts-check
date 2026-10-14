# FleetPro Push Discipline

**Follow exactly.** Repo = `vehicle-parts-check` (`Scalability-Vamsee/vehicle-parts-check`, transferred from `vamseebounce` on 2026-08-16) → GitHub Pages → **bounceops.online**. Push to the **`staging`** branch first (`git push origin HEAD:staging`), not directly to `main`.

This is the durable reference for every window (Cowork or Claude Code) that pushes FleetPro.
Paste `../docs/COWORK-PRIMER.md` into Cowork at session start; this file is the push-specific detail.

---

1. **ONE clone location: `/tmp/fleetpro-push`.** Never invent other dir names (no `/tmp/vehicle-parts-check`, etc.).

2. **ALWAYS re-clone fresh — never reuse an old clone** (stale base = rejected push or clobber):
   ```bash
   cd /tmp && rm -rf fleetpro-push && git clone https://<PAT>@github.com/Scalability-Vamsee/vehicle-parts-check.git fleetpro-push
   ```

3. **NEVER `git add`/`commit`/`push` from the mounted folder** `/Users/vamsee/Desktop/Scalability/Bounce/fleetpro`
   — it has NO `.git`, so git walks up to the outer Bounce repo (gitignored, deploys nothing).
   Copy files INTO `/tmp/fleetpro-push` and push from there.

4. **VERIFY before every push:**
   - `git status --porcelain` shows ONLY the files you intend.
   - Diff each changed file vs the fresh clone — confirm it's your change and nothing else
     (no accidental revert of another window's work).
   - Balance `{}` `()` `[]` and run `node --check` on every inline `<script>`.
   - Secret scan: block `github_pat_` / `ghp_` / hardcoded `service_role` keys.
     OK to keep: the public anon key (`role:"anon"`) and `Deno.env.get('...SERVICE_ROLE_KEY')` env reads.

5. **PAT: inline into the clone/push URL ONLY.** Never write it to a file, never `git remote set-url`
   (keeps it out of `.git/config`). Scrub the clone (`rm -rf /tmp/fleetpro-push`) after pushing.
   NEVER fabricate or guess a PAT — if you don't have it, hand the push to the window that does.

6. **LOCKS.md: claim the page/feature row** (owner + UTC + note) BEFORE editing; if already locked by
   another window, STOP and wait. Set it back to `(free)` after.

7. **Non-fast-forward = STOP.** If `git push` is rejected, someone pushed in between. Re-clone fresh and
   re-apply your change onto the new HEAD. NEVER force-push.

8. **Confirm + report:** after push, verify remote HEAD moved (`git ls-remote …/HEAD`) and report `oldSHA..newSHA`.

9. **Edge functions + migrations = SOURCE-OF-RECORD git push only.** NOT live until Cowork deploys via
   Supabase MCP + migration applied + pg_cron registered. Never call a git push alone "live" for these.

10. **Promoting staging to main (PR + merge via the API), checked 2026-10-14.**
    - `main` is protected but, as of 14 Oct, requires **0 reviews and no status checks**; a clean PR merges straight away. Use `merge_method: "merge"` (full staging merge, not squash).
    - A **fine-grained PAT** that can push to `staging` may still get `403 Resource not accessible by personal access token` on `POST /repos/.../pulls`: it needs the *Pull requests: write* permission. A **classic PAT** with `repo` scope can create and merge PRs. Either way the PAT goes inline in the request only, never in a file, and never in the PR text.
    - Order: (1) `GET /compare/main...staging` and confirm the PR is exactly the commits and files you expect (staging is always "behind" `main` by the earlier merge commits, so `diverged` is normal); (2) fill `.github/PULL_REQUEST_TEMPLATE.md` honestly (do not tick "Tested on bounceops.info" if you did not click through it); (3) `POST /pulls`, wait until `mergeable` is true and `mergeable_state` is `clean`; (4) `PUT /pulls/N/merge`; (5) GitHub Pages serves the new files 1 to 2 minutes later, so poll `bounceops.online` and compare the sha256 of the served file with the pushed one.
    - **Staging is `bounceops.info`; production is `bounceops.online`.** A change pushed to `staging` is not on `bounceops.online` until the PR is merged: check the right domain before saying a change is missing.
    - A hash guard on the staging file (the version you built from) is how a drifted `staging` gets caught before a whole-file copy overwrites someone else's work. Pin the staging hash and the mounted-file hash, and stop on any mismatch.

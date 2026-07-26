# FleetPro Push Discipline

**Follow exactly.** Repo = `vehicle-parts-check` (`vamseebounce/vehicle-parts-check`) → GitHub Pages → **bounceops.online**.

This is the durable reference for every window (Cowork or Claude Code) that pushes FleetPro.
Paste `../docs/COWORK-PRIMER.md` into Cowork at session start; this file is the push-specific detail.

---

1. **ONE clone location: `/tmp/fleetpro-push`.** Never invent other dir names (no `/tmp/vehicle-parts-check`, etc.).

2. **ALWAYS re-clone fresh — never reuse an old clone** (stale base = rejected push or clobber):
   ```bash
   cd /tmp && rm -rf fleetpro-push && git clone https://<PAT>@github.com/vamseebounce/vehicle-parts-check.git fleetpro-push
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

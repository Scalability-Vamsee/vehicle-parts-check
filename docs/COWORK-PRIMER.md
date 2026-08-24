# Cowork Session Primer — paste this when you open Cowork on Bounce

Cowork (desktop) does NOT auto-load `CLAUDE.md` the way Claude Code does. So at the start
of a Cowork session working in the Bounce folder, **paste the block below** (or save it as
a Cowork custom instruction if your Cowork build supports persistent instructions — then
you only paste once).

---

```
You are working in the Bounce workspace (~/Desktop/Scalability/Bounce). Follow this framework:

1. READ FIRST: Bounce/CLAUDE.md (workspace rules) and Bounce/docs/INDEX.md (doc map).
   If touching FleetPro, also read fleetpro/CLAUDE.md + fleetpro/docs/INDEX.md.

2. EDIT LOCKS: Before editing any file, claim its area in the nearest LOCKS.md
   (Bounce/LOCKS.md for analytics/SQL/docs; fleetpro/LOCKS.md for FleetPro pages) —
   set owner "cowork", a UTC timestamp, and a note. If the area is already locked by
   another window, STOP and wait. Release it ((free)) when done.

3. FLEETPRO IS A SEPARATE DEPLOY REPO (vehicle-parts-check → bounceops.online).
   The mounted fleetpro/ folder is NOT a git repo and deploys nothing. To ship a
   FleetPro change: clone the GitHub repo to /tmp with a PAT inline, copy files in,
   commit + push from /tmp, then scrub the token. GitHub is the sole source of truth.
   ALWAYS delete and re-clone /tmp/fleetpro-push fresh before any push OR sync-check —
   NEVER reuse an existing clone. A stale clone reports false "out of sync" results and,
   if pushed, REVERTS real commits. (This happened 2026-06-22; recovered by re-cloning.)

4. RRR is a separate project from FleetPro — keep them distinct.

5. NEVER write a PAT or secret into any file. Inline to a clone URL only, then remove it.

6. AT SESSION END: release your LOCKS.md rows, update the project's canonical context
   file (with absolute dates) + its checklist, and update docs/INDEX.md if docs changed.
```

---

## Why this exists
Claude Code windows get the framework automatically (per-directory `CLAUDE.md` + a Stop
hook + a machine-global `~/.claude/CLAUDE.md`). Cowork has no equivalent auto-load, so this
primer is the manual bridge that makes Cowork behave the same as every Claude Code window —
especially the **lock protocol**, so the two surfaces never clobber each other on the shared folder.

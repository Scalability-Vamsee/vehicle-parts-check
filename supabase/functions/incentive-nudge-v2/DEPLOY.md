# Deploy and switch on incentive-nudge-v2 (technician login mails)

For Vamsee's Claude (written 24 Nov 2026 for Shivani). The project token is enough; no organization access or invite is needed.

**What it is:** personal mails to technicians for incentive v2 (rules of the 5 Nov mail). Same setup as the old `incentive-nudge`
(Resend, `RESEND_API_KEY`, from `incentive@bounceops.online`). It only reads the incentive tables (`incentive_technicians`,
`incentive_jc_points`, `incentive_day_points`, `incentive_login_lock`) and sends mail. Code: `index.ts` in this folder (FleetPro staging).

- A technician who has not opened My Incentive yet gets **only the login mail** (4 steps to log in, "track your incentives here").
- After the first login: Monday = last week's result and this week's target; Wednesday and Friday = points so far and points still needed.
- Recipients: an email in the Technician Nomenclature Map and a billed job card in the last 21 days (about 115 on 24 Nov).
- Supabase sign-ups are on (`disable_signup: false`), so a technician without a FleetPro login gets one on the first sign-in.

## Steps

1. Read `index.ts`. Deploy with `verify_jwt = true`. **Every call must send the service-role key** as `Authorization: Bearer` (caller check added 24 Nov: any other caller, including the anon key, gets 401).
2. Deploy: `supabase functions deploy incentive-nudge-v2 --project-ref clkfvmmlgwcvntxnolsv`.
   Check that `RESEND_API_KEY` is in the project secrets. Set `NUDGE_SUMMARY_TO` to Shivani's work email (Vamsee knows it).
3. **Dry run (sends nothing):** call the function with `?dry=1&type=login`. Expect about 115 technicians.
4. **Test to Shivani only:** call `?type=login&to=<Shivani's work email>`. It sends at most 3 sample mails, only to her.
   **Stop here and wait for Shivani's OK.**
5. After her OK, **send to all technicians**: call `?type=login` once.
6. **Schedule:** a pg_cron job `30 2 * * 1,3,5` (Mon, Wed, Fri at 08:00 IST) calling the function with no `type`
   (it picks the mail by weekday). Give it its own credential (for example a Vault secret). Do not copy job 38's command,
   because it contains the project key. Keep job 38 (old `incentive-nudge-daily`) paused.
7. Report back: the deployed version, the dry-run count, that the test mail was sent, the send result (sent / errors), and the cron job id.

## Test options of the function

`?dry=1` no mail, returns subjects and a preview · `?type=mon|wed|fri|login` force a mail type ·
`?to=<email>` send to this one address instead of the technicians (at most 3 mails) · `?only=<Normalized Name>` one technician.

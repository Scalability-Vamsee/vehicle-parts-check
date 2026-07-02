-- ── incentive_week_config ─────────────────────────────────────────────────────
-- Per-week payment status. Admin (superadmin) sets payment_done = true
-- once payouts are processed; banner in incentive.html reads this.

CREATE TABLE IF NOT EXISTS public.incentive_week_config (
  week_start       DATE         PRIMARY KEY,
  payment_done     BOOLEAN      NOT NULL DEFAULT FALSE,
  payment_done_at  TIMESTAMPTZ,
  payment_done_by  TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.incentive_week_config ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read — banner visible to all logged-in techs
CREATE POLICY "public_read_week_config"
  ON public.incentive_week_config
  FOR SELECT USING (true);

-- No direct INSERT/UPDATE/DELETE from clients — goes through RPC below


-- ── set_week_payment_done RPC ─────────────────────────────────────────────────
-- Superadmin-only: upserts payment_done status for a given week.
-- Called from Admin tab "Mark Paid / Unmark" button.

CREATE OR REPLACE FUNCTION public.set_week_payment_done(
  p_week_start  DATE,
  p_done        BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email    TEXT;
  v_is_super BOOLEAN;
BEGIN
  SELECT email,
         COALESCE((raw_app_meta_data->>'is_superadmin')::boolean, false)
  INTO   v_email, v_is_super
  FROM   auth.users
  WHERE  id = auth.uid();

  IF NOT v_is_super THEN
    RAISE EXCEPTION 'Not authorized — superadmin required';
  END IF;

  INSERT INTO public.incentive_week_config
    (week_start, payment_done, payment_done_at, payment_done_by)
  VALUES
    (p_week_start, p_done, NOW(), v_email)
  ON CONFLICT (week_start) DO UPDATE SET
    payment_done    = EXCLUDED.payment_done,
    payment_done_at = NOW(),
    payment_done_by = EXCLUDED.payment_done_by;
END;
$$;

-- Allow authenticated callers (function itself checks superadmin)
GRANT EXECUTE ON FUNCTION public.set_week_payment_done TO authenticated;


-- ── incentive_feedback ────────────────────────────────────────────────────────
-- Stores feedback submitted via the Feedback FAB on incentive.html.
-- send-feedback edge function inserts here + emails vamsee@bounceshare.com.

CREATE TABLE IF NOT EXISTS public.incentive_feedback (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tech_name   TEXT,
  email       TEXT,
  hub_name    TEXT,
  message     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.incentive_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated techs can insert their own feedback
CREATE POLICY "auth_can_insert_feedback"
  ON public.incentive_feedback
  FOR INSERT TO authenticated WITH CHECK (true);

-- Only service_role reads (admin reviews via Supabase dashboard / future UI)
CREATE POLICY "service_role_reads_feedback"
  ON public.incentive_feedback
  FOR SELECT USING (auth.role() = 'service_role');

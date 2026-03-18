
CREATE TABLE public.mission_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert mission_logs" ON public.mission_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can select mission_logs" ON public.mission_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can update mission_logs" ON public.mission_logs FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_logs;

CREATE POLICY "Authenticated users can delete loads"
  ON public.loads FOR DELETE USING (true);
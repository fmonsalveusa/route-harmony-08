-- La página pública de onboarding valida su link sin sesión.
-- En vez de dejar la tabla legible para anon, se lee un solo token por su valor.
CREATE OR REPLACE FUNCTION public.onboarding_get_token(p_token text)
RETURNS SETOF public.onboarding_tokens
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.onboarding_tokens
  WHERE token = p_token AND status = 'pending' AND p_token IS NOT NULL AND length(p_token) >= 8
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.onboarding_get_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.onboarding_get_token(text) TO anon, authenticated;

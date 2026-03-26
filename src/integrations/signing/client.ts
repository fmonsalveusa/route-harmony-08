import { createClient } from '@supabase/supabase-js';

const SIGNING_URL = import.meta.env.VITE_SIGNING_SUPABASE_URL || 'https://twlaamzxthxhkkchzyzg.supabase.co';
const SIGNING_KEY = import.meta.env.VITE_SIGNING_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3bGFhbXp4dGh4aGtrY2h6eXpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjg4NzIsImV4cCI6MjA4OTk0NDg3Mn0.Z2CsExbG5gCaJ_pH9D7KEyQ5bmOLyG5AAcdczxlZ9oo';

export const signingSupabase = createClient(SIGNING_URL, SIGNING_KEY);

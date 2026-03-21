import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// On /cli-auth route, prevent Supabase from auto-detecting hash tokens.
// The CliAuth component handles the hash directly to show a paste code.
const isCliAuth = window.location.pathname === '/cli-auth';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: !isCliAuth,
  },
});

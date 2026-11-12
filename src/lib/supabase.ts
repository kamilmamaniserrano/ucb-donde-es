import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** null cuando no hay .env.local: la app funciona igual con los datos locales. */
export const supabase: SupabaseClient | null = url && clave ? createClient(url, clave) : null;

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://coumlezydpfpsbsjlail.supabase.co';
const supabaseAnonKey = 'sb_publishable_Jl4vSwXaADYk-Irdsrf54g_KZJyk8w4';

// Fallback to environment variables if needed
const finalUrl = supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
const finalKey = supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!finalUrl || !finalKey) {
  console.error('Supabase configuration missing. Check your credentials.');
}

export const supabase = createClient(finalUrl, finalKey);
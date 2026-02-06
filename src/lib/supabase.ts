
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

// Ensure no trailing slash
const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, '');

export const supabase: SupabaseClient = createClient(cleanSupabaseUrl, supabaseAnonKey, {
    global: {
        headers: {
            'apikey': supabaseAnonKey
        }
    }
});

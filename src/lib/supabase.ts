import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export async function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    
    if (data.supabaseUrl && data.supabaseAnonKey) {
      supabaseInstance = createClient(data.supabaseUrl, data.supabaseAnonKey, {
        db: {
          schema: data.supabaseSchema || 'public'
        }
      });
      return supabaseInstance;
    }
  } catch (e) {
    console.error('Failed to init Supabase', e);
  }
  
  return null;
}

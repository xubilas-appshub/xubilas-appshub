import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://laabusgvfdjnjljohbml.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhYWJ1c2d2ZmRqbmpsam9oYm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2MTI2NjMsImV4cCI6MjA4NzE4ODY2M30.95SrtSCY4Ajqbj2_I15QWsyKcrb9vFrnrQcoZPuWEo4';
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhYWJ1c2d2ZmRqbmpsam9oYm1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYxMjY2MywiZXhwIjoyMDg3MTg4NjYzfQ.uKv6okfjElUqijtYfkHTLa0rOZgnzPzf5G9uB3P-Yhg';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Using hardcoded Supabase credentials.');
}

export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey, 
  {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'xubilass-app-hub-auth'
    }
  }
);

/**
 * WARNING: This client uses the service_role key and has full administrative access.
 * It should only be used in the frontend if explicitly requested for a demo or
 * when a backend is not available. Be aware that exposing the service_role key
 * in the frontend is a security risk.
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export const syncToGoogleSheet = async (data: any) => {
  const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzDBCLyRhx0NPcc9P9zKqVGiQqUsVuJgmLKIS-KGOvPo75dqReS-eLq8mm5trrjImN5/exec';
  if (!scriptUrl) return;

  try {
    await fetch(scriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({ ...data, timestamp: new Date().toISOString() }),
    });
  } catch (error) {
    console.error('Error syncing to Google Sheets:', error);
  }
};

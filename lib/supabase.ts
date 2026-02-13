
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Extremely defensive check to prevent build-time crashes.
// We only call createClient if both strings are present and non-empty.
const isConfigured = Boolean(supabaseUrl && supabaseUrl.length > 0 && supabaseKey && supabaseKey.length > 0);

export const supabase = isConfigured 
  ? createClient(supabaseUrl!, supabaseKey!) 
  : null as any;

if (!isConfigured) {
  if (process.env.NODE_ENV === 'production') {
    // This will appear in build logs but won't crash the build
    console.warn('⚠️ Supabase credentials not found. Image uploads will be disabled in this environment.');
  }
}

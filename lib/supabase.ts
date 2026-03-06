
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nrrfumuslekbdjvgklqp.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ycmZ1bXVzbGVrYmRqdmdrbHFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA0MzcxOSwiZXhwIjoyMDgxNjE5NzE5fQ.oD9CSjmiytB71XfmHKmRvzEmW_SlkTMFRj48tRZqzs4';

// Extremely defensive check to prevent build-time crashes.
// We only call createClient if both strings are present and non-empty.
const isConfigured = Boolean(supabaseUrl && supabaseUrl.length > 0 && supabaseKey && supabaseKey.length > 0);

export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseKey) 
  : null as any;

if (!isConfigured) {
  if (process.env.NODE_ENV === 'production') {
    // This will appear in build logs but won't crash the build
    console.warn('⚠️ Supabase credentials not found. Image uploads will be disabled in this environment.');
  }
}

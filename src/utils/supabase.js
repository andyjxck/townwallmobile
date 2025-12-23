// /utils/supabase.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://twkxrgkkfhaylroyhfmi.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3a3hyZ2trZmhheWxyb3loZm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3NDU5MTQsImV4cCI6MjA2ODMyMTkxNH0.qXvsXgMD1byTNwaARXqqmGoKhPNkj4JaJ99zdBYotcU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

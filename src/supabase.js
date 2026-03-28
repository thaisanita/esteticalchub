import { createClient } from '@supabase/supabase-js';

// Sua URL fixa
const supabaseUrl = 'https://pxjckbpxyxkhytkigowa.supabase.co';

// COLE A CHAVE QUE COMEÇA COM 'sb_publishable...' AQUI:
const supabaseAnonKey =
'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4amNrYnB4eXhraHl0a2lnb3dhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NjU5NTAsImV4cCI6MjA4MzI0MTk1MH0.DPyoWgFXyPLk3tZXBPvxb8QgjTDY5wxiVF8BcJ2AOQE'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, 
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
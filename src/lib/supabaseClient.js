import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eyodotdtktfzumztemmt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5b2RvdGR0a3RmenVtenRlbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNzUyMTcsImV4cCI6MjA4Nzk1MTIxN30.iMR5tMXFL7dZIv5gz4LXeOfr3wJEQlZn7IO_PpdqMLU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

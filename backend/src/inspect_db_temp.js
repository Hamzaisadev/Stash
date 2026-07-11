import { supabase } from './supabase.js';

async function run() {
  console.log("Testing SQL execution via RPC...");
  // Let's try common names like exec_sql, run_sql, execute_sql
  const { data, error } = await supabase
    .rpc('exec_sql', { query: 'ALTER TABLE rooms ADD COLUMN description TEXT;' });

  if (error) {
    console.error("RPC exec_sql failed:", error.message);
  } else {
    console.log("RPC exec_sql succeeded:", data);
  }
}

run();

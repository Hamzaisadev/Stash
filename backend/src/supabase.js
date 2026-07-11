import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("CRITICAL ERROR: Supabase credentials are missing in the .env file!");
    process.exit(1);
}

// Create the unified administrative client
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false // Disable session persistence for stateless server-side requests
    }
});

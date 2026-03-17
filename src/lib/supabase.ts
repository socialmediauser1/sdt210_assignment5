import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../services/supabase-config";

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey);

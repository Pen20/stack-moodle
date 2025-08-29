// index.js
import express from "express";
import bodyParser from "body-parser";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(bodyParser.json());

// --- Supabase setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // use service role key for writes

// Add connection validation
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test database connection
async function testConnection() {
    try {
        const { data, error } = await supabase.from('learning_sessions').select('count').limit(1);
        if (error) throw error;
        console.log('✅ Successfully connected to Supabase database');
    } catch (err) {
        console.error('❌ Failed to connect to Supabase database:', err.message);
    }
}

testConnection();

// -------------------------
// 1. Start a learning session
// -------------------------
app.post("/session/start", async (req, res) => {
    try {
        const { page_url, anonymous_id } = req.body;
        const user_agent = req.headers["user-agent"];

        const { data, error } = await supabase
            .from("learning_sessions")
            .insert([
                { page_url, anonymous_id, user_agent }
            ])
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, session: data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------------------------
// 2. Record a question attempt
// -------------------------
app.post("/attempt", async (req, res) => {
    try {
        const {
            session_id,
            question_file,
            question_name,
            question_prefix,
            seed,
            score,
            max_score,
            is_correct
        } = req.body;

        const { data, error } = await supabase
            .from("question_attempts")
            .insert([
                {
                    session_id,
                    question_file,
                    question_name,
                    question_prefix,
                    seed,
                    score,
                    max_score,
                    is_correct
                }
            ])
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, attempt: data });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------------------------
// 3. Track inputs
// -------------------------
app.post("/input", async (req, res) => {
    try {
        const {
            attempt_id,
            session_id,
            input_name,
            input_value,
            input_type,
            is_final_answer,
            validation_result
        } = req.body;

        console.log('🔍 Input tracking request:', {
            attempt_id,
            session_id,
            input_name,
            input_value,
            input_type,
            is_final_answer,
            validation_result
        });

        const { data, error } = await supabase
            .from("input_tracking")
            .insert([
                {
                    attempt_id,
                    session_id,
                    input_name,
                    input_value,
                    input_type,
                    is_final_answer,
                    validation_result
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('❌ Supabase insert error:', error);
            throw error;
        }

        console.log('✅ Input tracking success:', data);
        res.json({ success: true, input: data });
    } catch (err) {
        console.error('❌ Input tracking failed:', err.message);
        res.status(400).json({ success: false, error: err.message });
    }
});

// -------------------------
// Health check
// -------------------------
app.get("/", (req, res) => {
    res.send("Supabase API is running ✅");
});

// -------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});

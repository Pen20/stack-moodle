// Supabase Configuration
// Replace these with your actual Supabase project credentials
// You can find these in your Supabase Dashboard -> Settings -> API

const SUPABASE_CONFIG = {
    url: 'https://pbgubbwkvzgfifvdjdvt.supabase.co', // e.g., 'https://your-project.supabase.co'
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiZ3ViYndrdnpnZmlmdmRqZHZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNzQxNDEsImV4cCI6MjA3MTk1MDE0MX0.mSTHMDvIyJCavDwl5ygBzGzno28be5MlUbyUtvOQCdM' // Your public anon key
};

// Example configuration (replace with your actual values):
// const SUPABASE_CONFIG = {
//     url: 'https://abcdefghijklmnop.supabase.co',
//     anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
// };

// Initialize Supabase client
let supabase;

try {
    if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn('⚠️ Please configure your Supabase credentials in config.js');
        console.log('📚 Instructions:');
        console.log('1. Go to https://supabase.com/dashboard');
        console.log('2. Create a new project or select existing one');
        console.log('3. Go to Settings -> API');
        console.log('4. Copy your Project URL and anon/public key');
        console.log('5. Replace the values in config.js');
    } else {
        // Wait for window.supabase to be available
        if (typeof window !== 'undefined' && window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log('✅ Supabase client initialized successfully');
        } else {
            console.warn('⚠️ Supabase library not loaded yet, will retry...');
            // Retry after a short delay
            setTimeout(() => {
                if (window.supabase) {
                    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
                    console.log('✅ Supabase client initialized successfully (retry)');
                } else {
                    console.error('❌ Supabase library failed to load');
                }
            }, 1000);
        }
    }
} catch (error) {
    console.error('❌ Error initializing Supabase:', error);
}
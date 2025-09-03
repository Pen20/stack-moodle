// Database operations for STACK API question tracking
// Handles anonymous session tracking and question interaction logging

// Global variables for session tracking
let currentSession = null;
let currentAttempts = {}; // Track attempts by question prefix

function formatSupabaseError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    const parts = [];
    if (err.message) parts.push(err.message);
    if (err.code) parts.push(`code=${err.code}`);
    if (err.details) parts.push(`details=${err.details}`);
    if (err.hint) parts.push(`hint=${err.hint}`);
    try {
        const rest = JSON.stringify(err);
        if (rest && rest !== '{}') parts.push(rest);
    } catch (_) {}
    return parts.join(' | ');
}

// Generate anonymous user identifier
function generateAnonymousId() {
    // Check if we already have one stored
    let anonymousId = localStorage.getItem('anonymousUserId');
    if (!anonymousId) {
        // Create a unique identifier based on timestamp and random number
        anonymousId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('anonymousUserId', anonymousId);
    }
    return anonymousId;
}

// Initialize database session when page loads
async function initializeDatabaseSession() {
    if (!supabase) {
        console.warn('Supabase not configured - database tracking disabled');
        return null;
    }

    try {
        const anonymousId = generateAnonymousId();
        
        // Create learning session
        let insertPayload = {
            page_url: window.location.href,
            user_agent: navigator.userAgent,
            anonymous_id: anonymousId
        };

        let result = await supabase
            .from('learning_sessions')
            .insert([insertPayload])
            .select()
            .single();

        let { data, error } = result;

        // Fallback if anonymous_id column doesn't exist (Postgres code 42703)
        if (error && (error.code === '42703' || /anonymous_id/i.test(error.message || ''))) {
            console.warn('anonymous_id column missing; retrying without it');
            const fallbackPayload = {
                page_url: window.location.href,
                user_agent: navigator.userAgent
            };
            ({ data, error } = await supabase
                .from('learning_sessions')
                .insert([fallbackPayload])
                .select()
                .single());
        }

        if (error) {
            console.error('Error creating learning session:', formatSupabaseError(error));
            return null;
        }

        currentSession = data;
        console.log('Database session initialized:', currentSession.id);
        return data;

    } catch (error) {
        console.error('Database session initialization failed:', formatSupabaseError(error));
        return null;
    }
}

// Create question attempt record
async function createQuestionAttempt(qfile, qname, qprefix, seed) {
    if (!supabase || !currentSession) {
        console.warn('Database not available for question attempt tracking');
        return null;
    }

    try {
        // Check if this is a retry (increment attempt number)
        const existingAttempt = currentAttempts[qprefix];
        const attemptNumber = existingAttempt ? existingAttempt.attempt_number + 1 : 1;

        const { data, error } = await supabase
            .from('question_attempts')
            .insert([
                {
                    session_id: currentSession.id,
                    question_file: qfile,
                    question_name: qname || null,
                    question_prefix: qprefix,
                    seed: seed || null,
                    attempt_number: attemptNumber
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating question attempt:', formatSupabaseError(error));
            return null;
        }

        // Store current attempt for this question
        currentAttempts[qprefix] = data;
        console.log('Question attempt created:', data.id);
        return data;

    } catch (error) {
        console.error('Question attempt creation failed:', formatSupabaseError(error));
        return null;
    }
}

// Update question attempt with submission results
async function updateQuestionAttempt(qprefix, score, maxScore, isCorrect) {
    if (!supabase || !currentAttempts[qprefix]) {
        console.warn('No question attempt to update');
        return null;
    }

    try {
        const attempt = currentAttempts[qprefix];
        
        const { data, error } = await supabase
            .from('question_attempts')
            .update({
                submitted_at: new Date().toISOString(),
                score: score,
                max_score: maxScore,
                is_correct: isCorrect
            })
            .eq('id', attempt.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating question attempt:', formatSupabaseError(error));
            return null;
        }

        // Update local cache
        currentAttempts[qprefix] = data;
        console.log('Question attempt updated:', data.id);
        return data;

    } catch (error) {
        console.error('Question attempt update failed:', formatSupabaseError(error));
        return null;
    }
}

// Track input interactions
async function trackInput(qprefix, inputName, inputValue, inputType, isFinalAnswer = false, validationResult = null) {
    if (!supabase || !currentSession) {
        return null;
    }

    // Ensure we have a valid attempt before tracking
    if (!currentAttempts[qprefix]) {
        console.warn('No question attempt found for input tracking, skipping:', qprefix);
        return null;
    }

    try {
        const attempt = currentAttempts[qprefix];
        
        // Verify the attempt exists in database before tracking inputs
        const { data: attemptExists } = await supabase
            .from('question_attempts')
            .select('id')
            .eq('id', attempt.id)
            .maybeSingle();
            
        if (!attemptExists) {
            console.error('Attempt not found in database:', attempt.id);
            return null;
        }
        
        // For final answers, consolidate all related inputs into one record
        if (isFinalAnswer) {
            return await trackConsolidatedInput(attempt, inputName, inputValue, inputType, validationResult);
        }
        
        // Skip regular input tracking - only track final answers
        return null;

    } catch (error) {
        console.error('Input tracking failed:', formatSupabaseError(error));
        return null;
    }
}

// Track consolidated final answer (groups matrix/complex inputs)
async function trackConsolidatedInput(attempt, inputName, inputValue, inputType, validationResult) {
    // Check if we already have a final answer record for this input
    const { data: existing } = await supabase
        .from('input_tracking')
        .select('id')
        .eq('attempt_id', attempt.id)
        .eq('input_name', inputName)
        .eq('is_final_answer', true)
        .maybeSingle();
    
    if (existing) {
        // Update existing final answer record
        const { data, error } = await supabase
            .from('input_tracking')
            .update({
                input_value: inputValue,
                validation_result: validationResult,
                timestamp: new Date().toISOString()
            })
            .eq('id', existing.id)
            .select()
            .single();
            
        if (error) {
            console.error('Error updating consolidated input:', formatSupabaseError(error));
            return null;
        }
        return data;
    } else {
        // Create new final answer record
        const { data, error } = await supabase
            .from('input_tracking')
            .insert([
                {
                    attempt_id: attempt.id,
                    session_id: currentSession.id,
                    input_name: inputName,
                    input_value: inputValue,
                    input_type: inputType,
                    is_final_answer: true,
                    validation_result: validationResult
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating consolidated input:', formatSupabaseError(error));
            return null;
        }
        return data;
    }
}

// Track regular input interactions (with throttling)
async function trackRegularInput(attempt, inputName, inputValue, inputType, validationResult) {
    // Only track significant changes, not every keystroke
    if (inputValue === '' || inputValue === 'EMPTY') {
        return null; // Skip empty values
    }
    
    const { data, error } = await supabase
        .from('input_tracking')
        .insert([
            {
                attempt_id: attempt.id,
                session_id: currentSession.id,
                input_name: inputName,
                input_value: inputValue,
                input_type: inputType,
                is_final_answer: false,
                validation_result: validationResult
            }
        ])
        .select()
        .single();

    if (error) {
        console.error('Error tracking regular input:', formatSupabaseError(error));
        return null;
    }
    return data;
}

// End current session
async function endDatabaseSession() {
    if (!supabase || !currentSession) {
        return;
    }

    try {
        const { error } = await supabase
            .from('learning_sessions')
            .update({
                session_end: new Date().toISOString()
            })
            .eq('id', currentSession.id);

        if (error) {
            console.error('Error ending session:', formatSupabaseError(error));
        } else {
            console.log('Database session ended');
        }

    } catch (error) {
        console.error('Session end failed:', formatSupabaseError(error));
    }
}

// Utility function to extract input details
function getInputDetails(inputElement) {
    const inputType = inputElement.type || inputElement.tagName.toLowerCase();
    let inputValue = inputElement.value;
    
    // Handle different input types
    if (inputType === 'checkbox' || inputType === 'radio') {
        inputValue = inputElement.checked ? inputElement.value : '';
    }
    
    return {
        type: inputType,
        value: inputValue
    };
}

// Initialize database tracking when page unloads
window.addEventListener('beforeunload', function() {
    endDatabaseSession();
});

// Export functions for use in other scripts
window.databaseTracking = {
    initializeDatabaseSession,
    createQuestionAttempt,
    updateQuestionAttempt,
    trackInput,
    endDatabaseSession,
    getInputDetails
}; 
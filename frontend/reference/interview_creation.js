import { UIUtils } from './js/utils/ui.js';
import { authState } from './js/state/auth-state.js';
import { createClient, getSupabaseClient } from './js/config/supabase.js';

// DOM Elements
const connectBtn = document.getElementById('connect-btn');
const connectBtnText = document.getElementById('connect-btn-text');
const connectLoader = document.getElementById('connect-loader');
const candidateSelect = document.getElementById('candidate-select');
const jobSelect = document.getElementById('job-select');
const createAppBtn = document.getElementById('create-app-btn');
const techQuestionsDiv = document.getElementById('technical-questions');
const behaveQuestionsDiv = document.getElementById('behavioral-questions');
const selectionCounter = document.getElementById('selection-counter');
const resumeUpload = document.getElementById('resume-upload');
const scheduleBtn = document.getElementById('schedule-btn');
const scheduleBtnText = document.getElementById('schedule-btn-text');
const scheduleLoader = document.getElementById('schedule-loader');
const interviewerPromptSelect = document.getElementById('interviewer-prompt-select');
const evaluatorPromptSelect = document.getElementById('evaluator-prompt-select');
const useExistingResumeRadio = document.getElementById('use-existing-resume');
const uploadNewResumeRadio = document.getElementById('upload-new-resume');
const existingResumeSection = document.getElementById('existing-resume-section');
const uploadResumeSection = document.getElementById('upload-resume-section');
const existingResumeSelect = document.getElementById('existing-resume-select');

const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const step3 = document.getElementById('step-3');
const step35 = document.getElementById('step-3-5');
const step4 = document.getElementById('step-4');

const activityLog = document.getElementById('activity-log');
const loadingState = document.getElementById('loading-state');

// Initialize services
// const authService = new AuthService();

let supabaseClient = null;
let currentApplicationId = null;
let currentCandidateId = null;

// --- Logger ---
const log = (message, type = 'info') => {
    const logItem = document.createElement('div');
    logItem.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logItem.className = `log-item log-${type}`;
    activityLog.prepend(logItem);
};

// --- Load Existing Resumes ---
const loadExistingResumes = async (candidateId) => {
    try {
        log(`Fetching existing resume for candidate ${candidateId}...`, 'info');
        const { data: candidateData, error: candidateError } = await supabaseClient
            .from('candidates')
            .select('resume_path, first_name, last_name')
            .eq('candidate_id', candidateId)
            .single();

        if (candidateError) throw candidateError;

        if (candidateData.resume_path) {
            const filename = candidateData.resume_path.split('/').pop().split('%20').join(' ');
            existingResumeSelect.innerHTML = `<option value="${candidateData.resume_path}">${filename}</option>`;
            log(`Loaded existing resume: ${filename}`, 'success');
        } else {
            existingResumeSelect.innerHTML = '<option value="">No existing resume</option>';
            log('No existing resume found for this candidate.', 'info');
        }
    } catch (error) {
        log(`Failed to load existing resume: ${error.message}`, 'error');
        existingResumeSelect.innerHTML = '<option value="">Error loading resume</option>';
    }
};

// --- Helper Functions ---
const createQuestionCheckbox = (question) => {
    return `
        <label class="flex items-start p-2 rounded-md hover:bg-gray-50">
            <input type="checkbox" name="question-checkbox" value="${question.question_id}" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1">
            <span class="ml-3 text-sm text-gray-700">${question.text}</span>
        </label>
    `;
};

const updateSelectionCount = () => {
    const selectedCount = document.querySelectorAll('input[name="question-checkbox"]:checked').length;
    const hasResume = (uploadNewResumeRadio.checked && resumeUpload.files[0]) || (useExistingResumeRadio.checked && existingResumeSelect.value);
    selectionCounter.textContent = `Selected questions: ${selectedCount}`;
    scheduleBtn.disabled = selectedCount === 0 || !hasResume;
};

// --- Automatic Initialization ---
const initializeApp = async () => {
    try {
        log('Initializing authentication and Supabase connection...', 'info');

        // Initialize auth state first
        await authState.initialize();
        log('Auth state initialized.', 'info');

        // Get Supabase client from environment
        supabaseClient = await getSupabaseClient();
        log('Supabase client initialized. Fetching initial data...', 'info');

        const [candidatesRes, jobsRes] = await Promise.all([
            supabaseClient.from('candidates').select('candidate_id, email, first_name, last_name'),
            supabaseClient.from('jobs').select('job_id, title')
        ]);

        if (candidatesRes.error) throw candidatesRes.error;
        if (jobsRes.error) throw jobsRes.error;

        candidateSelect.innerHTML = candidatesRes.data.map(c => `<option value="${c.candidate_id}">${c.first_name} ${c.last_name} (${c.email})</option>`).join('');
        jobSelect.innerHTML = jobsRes.data.map(j => `<option value="${j.job_id}">${j.title}</option>`).join('');

        log('Successfully fetched candidates and jobs.', 'success');

        // Hide loading state and show main interface
        UIUtils.hide(loadingState);
        UIUtils.show(step1);

    } catch (error) {
        log(`Initialization failed: ${error.message}`, 'error');
        // Keep loading state visible and show error
        if (loadingState) {
            loadingState.innerHTML = `
                <div class="text-center p-8">
                    <div class="text-red-500 mb-4">❌ Initialization Failed</div>
                    <div class="text-sm text-gray-600">${error.message}</div>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Retry
                    </button>
                </div>
            `;
        }
    }
};

// --- Application Creation & Question Loading ---
if (createAppBtn) {
    createAppBtn.addEventListener('click', async () => {
        const candidateId = candidateSelect.value;
        const jobId = jobSelect.value;
        log(`Creating application for candidate ${candidateId} and job ${jobId}...`, 'info');

        try {
            // Upsert application
            const { data: appData, error: appError } = await supabaseClient
                .from('applications')
                .upsert({ candidate_id: candidateId, job_id: jobId }, { onConflict: 'candidate_id, job_id' })
                .select()
                .single();

            if (appError) throw appError;
            currentApplicationId = appData.application_id;
            log(`Application created/found with ID: ${currentApplicationId}`, 'success');
            
            log('Fetching question pools...', 'info');
            
            // Fetch questions
            const [techRes, behaveRes] = await Promise.all([
                supabaseClient.from('job_questions').select('questions(*)').eq('job_id', jobId),
                supabaseClient.from('questions').select('*').eq('category', 'Behavioral')
            ]);

            if (techRes.error) throw techRes.error;
            if (behaveRes.error) throw behaveRes.error;

            const technicalQuestions = techRes.data.map(item => item.questions);
            const behavioralQuestions = behaveRes.data;

            techQuestionsDiv.innerHTML = technicalQuestions.map(q => createQuestionCheckbox(q)).join('');
            behaveQuestionsDiv.innerHTML = behavioralQuestions.map(q => createQuestionCheckbox(q)).join('');

            log(`Loaded ${technicalQuestions.length} technical and ${behavioralQuestions.length} behavioral questions.`, 'success');

            // Fetch prompts
            log('Fetching available prompts...', 'info');
            const { data: promptsData, error: promptsError } = await supabaseClient
                .from('prompt_versions')
                .select('prompt_version_id, version, prompts(name, purpose)')
                .order('version', { ascending: false });

            if (promptsError) throw promptsError;

            // Group by purpose
            const interviewerPrompts = promptsData.filter(p => p.prompts?.purpose === 'interviewer');
            const evaluatorPrompts = promptsData.filter(p => p.prompts?.purpose === 'evaluator');

            // Populate dropdowns
            interviewerPromptSelect.innerHTML = '<option value="">Use Latest</option>' +
                interviewerPrompts.map(p => `<option value="${p.prompt_version_id}">v${p.version} - ${p.prompts.name}</option>`).join('');
            evaluatorPromptSelect.innerHTML = '<option value="">Use Latest</option>' +
                evaluatorPrompts.map(p => `<option value="${p.prompt_version_id}">v${p.version} - ${p.prompts.name}</option>`).join('');

            log(`Loaded ${interviewerPrompts.length} interviewer and ${evaluatorPrompts.length} evaluator prompt versions.`, 'success');

            UIUtils.show(step3);
            UIUtils.show(step35);
            UIUtils.show(step4);
            
            // Add event listeners for checkboxes to update counter
            document.querySelectorAll('input[name="question-checkbox"]').forEach(checkbox => {
                checkbox.addEventListener('change', updateSelectionCount);
            });

        } catch (error) {
            log(`Failed to create application or fetch questions: ${error.message}`, 'error');
        }
    });
} else {
    console.error('createAppBtn not found, cannot set up event listener');
}

// Resume upload and selection event listeners
if (resumeUpload) {
    resumeUpload.addEventListener('change', updateSelectionCount);
}
if (existingResumeSelect) {
    existingResumeSelect.addEventListener('change', updateSelectionCount);
}

// Resume option radio buttons
if (useExistingResumeRadio) {
    useExistingResumeRadio.addEventListener('change', () => {
        if (useExistingResumeRadio.checked) {
            UIUtils.show(existingResumeSection);
            UIUtils.hide(uploadResumeSection);
        }
    });
}

if (uploadNewResumeRadio) {
    uploadNewResumeRadio.addEventListener('change', () => {
        if (uploadNewResumeRadio.checked) {
            UIUtils.hide(existingResumeSection);
            UIUtils.show(uploadResumeSection);
        }
    });
}

// Candidate selection change
if (candidateSelect) {
    candidateSelect.addEventListener('change', async () => {
        currentCandidateId = candidateSelect.value;
        if (currentCandidateId && supabaseClient) {
            await loadExistingResumes(currentCandidateId);
        }
    });
}


// --- Schedule Interview (Invoke Edge Function) ---
if (scheduleBtn) {
    scheduleBtn.addEventListener('click', async () => {
            if (!currentApplicationId) {
                log('No active application ID.', 'error');
                return;
            }

            const selectedQuestionIds = Array.from(document.querySelectorAll('input[name="question-checkbox"]:checked')).map(cb => cb.value);
            let resumePath;

            if (uploadNewResumeRadio.checked) {
                const resumeFile = resumeUpload.files[0];
                if (!resumeFile) {
                    log('You must select a resume file to upload.', 'error');
                    return;
                }
                
                // Validate file
                if (resumeFile.size > 10 * 1024 * 1024) { // 10MB limit
                    log('Resume file is too large. Please select a file smaller than 10MB.', 'error');
                    return;
                }
                
                if (!resumeFile.type.includes('pdf') && !resumeFile.name.toLowerCase().endsWith('.pdf')) {
                    log('Please select a PDF file.', 'error');
                    return;
                }
                
                log(`Uploading ${resumeFile.name} (${(resumeFile.size / 1024).toFixed(1)} KB)...`, 'info');
                UIUtils.show(scheduleLoader);
                scheduleBtnText.textContent = 'Uploading...';
                scheduleBtn.disabled = true;

                // Upload resume to Supabase storage with timeout and better error handling
                resumePath = `resumes/${Date.now()}-${resumeFile.name}`;
                
                // Check if file already exists (unlikely but good practice)
                try {
                    const { data: existingFiles } = await supabaseClient.storage
                        .from('resumes')
                        .list('', { search: resumePath });
                    
                    if (existingFiles && existingFiles.length > 0) {
                        resumePath = `resumes/${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${resumeFile.name}`;
                        log('Adjusted resume path to avoid conflicts.', 'info');
                    }
                } catch (listError) {
                    // Ignore list errors, proceed with upload
                }
                
                // Create upload promise with timeout
                const uploadPromise = supabaseClient.storage
                    .from('resumes')
                    .upload(resumePath, resumeFile, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                // Add timeout to upload
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Upload timeout after 30 seconds')), 30000);
                });
                
                try {
                    const { data: uploadData, error: uploadError } = await Promise.race([uploadPromise, timeoutPromise]);
                    
                    if (uploadError) {
                        // Check for specific error types
                        if (uploadError.message?.includes('Bucket not found')) {
                            throw new Error('Resumes storage bucket does not exist. Please contact administrator.');
                        } else if (uploadError.message?.includes('Unauthorized')) {
                            throw new Error('Not authorized to upload files. Please check permissions.');
                        } else {
                            throw new Error(`Upload failed: ${uploadError.message}`);
                        }
                    }
                    
                    log(`Resume uploaded successfully to: ${resumePath}`, 'success');
                } catch (uploadErr) {
                    log(`Resume upload failed: ${uploadErr.message}`, 'error');
                    throw uploadErr;
                }

                if (uploadError) throw uploadError;
                
                log('Resume uploaded successfully.', 'success');
                
                // Save resume metadata to database - update candidate's resume_path
                const { error: resumeUpdateError } = await supabaseClient
                    .from('candidates')
                    .update({ resume_path: resumePath })
                    .eq('candidate_id', currentCandidateId);
                
                if (resumeUpdateError) {
                    log(`Warning: Failed to update candidate resume path: ${resumeUpdateError.message}`, 'error');
                } else {
                    log('Candidate resume path updated successfully.', 'success');
                }
            } else {
                // Use existing resume
                resumePath = existingResumeSelect.value;
                if (!resumePath) {
                    log('You must select an existing resume.', 'error');
                    return;
                }
                
                log('Using existing resume.', 'info');
                UIUtils.show(scheduleLoader);
                scheduleBtnText.textContent = 'Scheduling...';
                scheduleBtn.disabled = true;
            }

            if (selectedQuestionIds.length === 0) {
                log('You must select at least one question.', 'error');
                return;
            }

            try {
                log('Invoking Edge Function...', 'info');

                const body = {
                    application_id: currentApplicationId,
                    question_ids: selectedQuestionIds,
                    resume_path: resumePath
                };

                const interviewerPromptId = interviewerPromptSelect.value;
                const evaluatorPromptId = evaluatorPromptSelect.value;

                if (interviewerPromptId) body.interviewer_prompt_version_id = interviewerPromptId;
                if (evaluatorPromptId) body.evaluator_prompt_version_id = evaluatorPromptId;

                const { data, error } = await supabaseClient.functions.invoke('schedule-interview', {
                    body
                });

                if (error) throw error;

                log('Edge Function invoked successfully!', 'success');
                log(`Response: ${JSON.stringify(data)}`, 'info');
                
            } catch (error) {
                 log(`Error: ${error.message || 'An unknown error occurred.'}`, 'error');
                 if(error.context) {
                    log(`Error context: ${JSON.stringify(error.context)}`, 'error');
                 }
            } finally {
                UIUtils.hide(scheduleLoader);
                scheduleBtnText.textContent = 'Schedule Interview';
                updateSelectionCount(); // Re-enable if conditions are met
            }
        });
} else {
    console.error('scheduleBtn not found, cannot set up event listener');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});
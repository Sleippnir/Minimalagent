import { authState } from '../js/state/auth-state.js';
import { getSupabaseClient } from '../js/config/supabase.js';
import { UIUtils } from '../js/utils/ui.js';

console.log('HR Dashboard JS loaded');

// DOM Elements
const userInfo = document.getElementById('user-info');
const logoutBtn = document.getElementById('logout-btn');
const totalInterviewsEl = document.getElementById('total-interviews');
const scheduledTodayEl = document.getElementById('scheduled-today');
const inProgressEl = document.getElementById('in-progress');
const completedEl = document.getElementById('completed');
const createInterviewBtn = document.getElementById('create-interview-btn');
const viewCalendarBtn = document.getElementById('view-calendar-btn');
const manageCandidatesBtn = document.getElementById('manage-candidates-btn');
const interviewsTableBody = document.getElementById('interviews-table-body');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const statusFilter = document.getElementById('status-filter');
const dateFilter = document.getElementById('date-filter');

let supabaseClient = null;

/**
 * Initialize the HR dashboard: verify authentication and HR access, load either mock or real interview data, and attach UI event handlers.
 *
 * Initializes the authentication state, ensures the current user has HR privileges (redirects to the login page on failure), updates the displayed user information, selects mock data or obtains a Supabase client for real sessions (assigning it to the module-level `supabaseClient`), loads dashboard data, and registers event listeners for dashboard UI controls. On fatal errors the function alerts the user and navigates to the login page.
 */
async function initializeDashboard() {
    console.log('initializeDashboard called');
    try {
        // Initialize auth state
        await authState.initialize();

        // Check if user is authenticated and has HR role
        const session = authState.getSession();
        console.log('Session:', session);
        console.log('Session user:', session?.user);
        console.log('User metadata:', session?.user?.user_metadata);
        
        if (!session) {
            console.log('No session found, redirecting to login');
            window.location.href = '../manager_login.html';
            return;
        }

        // Check user role (assuming we have a user_roles table or metadata)
        const user = session.user;
        const isHR = user.user_metadata?.role === 'hr' || user.email?.includes('hr@') || user.email?.includes('recruiter@');
        console.log('isHR check:', isHR, 'role:', user.user_metadata?.role, 'email:', user.email);

        if (!isHR) {
            console.log('User is not HR, redirecting');
            alert('Access denied. HR privileges required.');
            await authState.authService.signOut();
            window.location.href = '../manager_login.html';
            return;
        }

        // Display user info
        userInfo.textContent = `Welcome, ${user.user_metadata?.full_name || user.email}`;

        // Check if this is a mock session
        const isMockSession = !session.access_token || session.access_token === 'mock-token';

        if (isMockSession) {
            // For mock sessions, show mock data without connecting to Supabase
            await loadMockDashboardData();
        } else {
            // Initialize Supabase client for real sessions
            supabaseClient = await getSupabaseClient();

            // Load dashboard data
            await loadDashboardData();
        }

        // Setup event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Dashboard initialization error:', error);
        alert('Failed to initialize dashboard. Please try again.');
        window.location.href = '../manager_login.html';
    }
}

/**
 * Fetches interview records from the backend and refreshes the dashboard UI.
 *
 * Loads interviews (including related applications, candidates, and jobs), updates the dashboard statistics,
 * populates the interviews table, and manages the loading/empty UI states. On failure, logs the error and alerts the user.
 */
async function loadDashboardData() {
    try {
        UIUtils.show(loadingState);
        UIUtils.hide(emptyState);

        // Load interviews with related data
        const { data: interviews, error } = await supabaseClient
            .from('interviews')
            .select(`
                *,
                applications (
                    candidates (
                        first_name,
                        last_name,
                        email
                    ),
                    jobs (
                        title
                    )
                )
            `)
            .order('scheduled_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        // Update stats
        updateStats(interviews || []);

        // Populate interviews table
        populateInterviewsTable(interviews || []);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Failed to load dashboard data. Please refresh the page.');
    } finally {
        UIUtils.hide(loadingState);
    }
}

/**
 * Load a predefined set of mock interviews, update dashboard statistics, and render the interviews table.
 *
 * Shows a loading state while simulating a short delay, hides the empty-state placeholder, computes and displays stats, and populates the interviews table with mock data. On failure it logs the error and displays an alert to the user; the loading state is always cleared when the operation completes.
 */
async function loadMockDashboardData() {
    console.log('loadMockDashboardData called');
    try {
        UIUtils.show(loadingState);
        UIUtils.hide(emptyState);

        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Mock data
        const mockInterviews = [
            {
                interview_id: 'mock-1',
                status: 'scheduled',
                scheduled_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
                applications: {
                    candidates: {
                        first_name: 'John',
                        last_name: 'Doe',
                        email: 'john.doe@example.com'
                    },
                    jobs: {
                        title: 'Senior Software Engineer'
                    }
                }
            },
            {
                interview_id: 'mock-2',
                status: 'in_progress',
                scheduled_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
                applications: {
                    candidates: {
                        first_name: 'Jane',
                        last_name: 'Smith',
                        email: 'jane.smith@example.com'
                    },
                    jobs: {
                        title: 'Product Manager'
                    }
                }
            },
            {
                interview_id: 'mock-3',
                status: 'completed',
                scheduled_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
                applications: {
                    candidates: {
                        first_name: 'Bob',
                        last_name: 'Johnson',
                        email: 'bob.johnson@example.com'
                    },
                    jobs: {
                        title: 'UX Designer'
                    }
                }
            }
        ];

        console.log('Mock interviews:', mockInterviews);

        // Update stats
        updateStats(mockInterviews);

        // Populate interviews table
        populateInterviewsTable(mockInterviews);

        console.log('Mock data loaded successfully');

    } catch (error) {
        console.error('Error loading mock dashboard data:', error);
        alert('Failed to load mock dashboard data. Please refresh the page.');
    } finally {
        UIUtils.hide(loadingState);
    }
}

/**
 * Update dashboard counters (total, scheduled today, in progress, completed) from the given interviews.
 * @param {Array<Object>} interviews - Interview records to summarize. Each object must include `scheduled_at` (ISO date/time string or timestamp) and `status` (e.g., `'scheduled'`, `'in_progress'`, `'completed'`, `'cancelled'`). The function updates global UI elements with the computed counts.
 */
function updateStats(interviews) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let total = interviews.length;
    let scheduledToday = 0;
    let inProgress = 0;
    let completed = 0;

    interviews.forEach(interview => {
        const scheduledDate = new Date(interview.scheduled_at);

        // Count scheduled for today
        if (scheduledDate >= today && scheduledDate < new Date(today.getTime() + 24 * 60 * 60 * 1000)) {
            scheduledToday++;
        }

        // Count by status
        switch (interview.status) {
            case 'in_progress':
                inProgress++;
                break;
            case 'completed':
                completed++;
                break;
        }
    });

    totalInterviewsEl.textContent = total;
    scheduledTodayEl.textContent = scheduledToday;
    inProgressEl.textContent = inProgress;
    completedEl.textContent = completed;
}

/**
 * Render interviews into the table and toggle the empty-state UI.
 *
 * Populates the interviews table body with a row for each interview and shows the empty state when the array is empty.
 * @param {Array<Object>} interviews - Array of interview records; each item is expected to include related application, candidate, and job data used to build the table row.
 */
function populateInterviewsTable(interviews) {
    console.log('populateInterviewsTable called with', interviews.length, 'interviews');
    interviewsTableBody.innerHTML = '';

    if (interviews.length === 0) {
        UIUtils.show(emptyState);
        return;
    }

    UIUtils.hide(emptyState);

    interviews.forEach((interview, index) => {
        console.log('Creating row for interview', index, interview);
        const row = createInterviewRow(interview);
        interviewsTableBody.appendChild(row);
    });

    console.log('Table populated with', interviews.length, 'rows');
}

/**
 * Create a table row element representing a single interview for display in the interviews table.
 *
 * @param {Object} interview - Interview record to render.
 *   Expected shape (properties used): 
 *     - interview.interview_id {string}
 *     - interview.status {string}
 *     - interview.scheduled_at {string|number|Date}
 *     - interview.applications?.candidates {Object} with `first_name`, `last_name`, `email`
 *     - interview.applications?.jobs {Object} with `title`
 * @returns {HTMLTableRowElement} A table row element containing cells for candidate info, job title, status badge, scheduled date, and action buttons.
 */
function createInterviewRow(interview) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-white/5 transition-colors';

    const candidate = interview.applications?.candidates;
    const job = interview.applications?.jobs;

    const candidateName = candidate ? `${candidate.first_name} ${candidate.last_name}` : 'Unknown';
    const candidateEmail = candidate?.email || '';
    const jobTitle = job?.title || 'Unknown';

    const statusBadge = getStatusBadge(interview.status);
    const scheduledDate = new Date(interview.scheduled_at).toLocaleDateString();

    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center">
                <div>
                    <div class="text-sm font-medium text-white">${candidateName}</div>
                    <div class="text-sm text-white/70">${candidateEmail}</div>
                </div>
            </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-white">${jobTitle}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            ${statusBadge}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-white/70">
            ${scheduledDate}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <div class="flex space-x-2">
                <button class="text-blue-400 hover:text-blue-300 transition-colors" onclick="viewInterview('${interview.interview_id}')">
                    View
                </button>
                <button class="text-green-400 hover:text-green-300 transition-colors" onclick="editInterview('${interview.interview_id}')">
                    Edit
                </button>
                <button class="text-red-400 hover:text-red-300 transition-colors" onclick="cancelInterview('${interview.interview_id}')">
                    Cancel
                </button>
            </div>
        </td>
    `;

    return row;
}

/**
 * Render an HTML status badge for an interview status.
 * @param {string} status - One of 'scheduled', 'in_progress', 'completed', or 'cancelled'. Unrecognized values produce an "Unknown" badge.
 * @returns {string} A span HTML string containing the status label with appropriate color classes.
 */
function getStatusBadge(status) {
    const statusConfig = {
        scheduled: { color: 'bg-blue-500/20 text-blue-300', text: 'Scheduled' },
        in_progress: { color: 'bg-yellow-500/20 text-yellow-300', text: 'In Progress' },
        completed: { color: 'bg-green-500/20 text-green-300', text: 'Completed' },
        cancelled: { color: 'bg-red-500/20 text-red-300', text: 'Cancelled' }
    };

    const config = statusConfig[status] || { color: 'bg-gray-500/20 text-gray-300', text: 'Unknown' };

    return `<span class="px-2 py-1 text-xs rounded-full ${config.color}">${config.text}</span>`;
}

/**
 * Attach UI event handlers for dashboard controls (logout, navigation, view stubs, and filters).
 *
 * Binds click handlers for logout (signs out and navigates to the login page), create interview (navigates to the interview creation page), calendar and candidate management buttons (show informational alerts), and change handlers for status and date filters (invoke filterInterviews to update visible rows).
 */
function setupEventListeners() {
    // Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await authState.signOut();
            window.location.href = '../manager_login.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    // Create interview
    createInterviewBtn.addEventListener('click', () => {
        window.location.href = '../interview_creation.html';
    });

    // View calendar
    viewCalendarBtn.addEventListener('click', () => {
        // TODO: Implement calendar view
        alert('Calendar view coming soon!');
    });

    // Manage candidates
    manageCandidatesBtn.addEventListener('click', () => {
        // TODO: Implement candidate management
        alert('Candidate management coming soon!');
    });

    // Filters
    statusFilter.addEventListener('change', filterInterviews);
    dateFilter.addEventListener('change', filterInterviews);
}

/**
 * Filter the interviews table rows using the current status and date controls.
 *
 * Reads the selected values from the global `statusFilter` and `dateFilter` controls and hides any table rows in `interviewsTableBody` whose interview status or scheduled date do not match the selected filters by setting their `display` style to `none`. Rows that match both active filters remain visible.
 */
function filterInterviews() {
    const statusValue = statusFilter.value;
    const dateValue = dateFilter.value;

    const rows = interviewsTableBody.querySelectorAll('tr');

    rows.forEach(row => {
        const statusBadge = row.querySelector('span');
        const status = statusBadge.textContent.toLowerCase().replace(' ', '_');
        const dateCell = row.cells[3];
        const rowDate = new Date(dateCell.textContent).toISOString().split('T')[0];

        let showRow = true;

        if (statusValue && status !== statusValue) {
            showRow = false;
        }

        if (dateValue && rowDate !== dateValue) {
            showRow = false;
        }

        row.style.display = showRow ? '' : 'none';
    });
}

// Global functions for button actions
window.viewInterview = function(interviewId) {
    if (interviewId.startsWith('mock-')) {
        alert(`Viewing mock interview: ${interviewId}\n\nThis would open the interview interface in a new tab.`);
    } else {
        window.open(`../interview.html?interview_id=${interviewId}`, '_blank');
    }
};

window.editInterview = function(interviewId) {
    if (interviewId.startsWith('mock-')) {
        alert(`Editing mock interview: ${interviewId}\n\nThis would redirect to the interview details page.`);
    } else {
        window.location.href = `interview-details.html?interview_id=${interviewId}`;
    }
};

window.cancelInterview = async function(interviewId) {
    if (interviewId.startsWith('mock-')) {
        alert(`Mock interview ${interviewId} cancelled successfully!`);
        // Reload the page to refresh mock data
        window.location.reload();
        return;
    }

    if (confirm('Are you sure you want to cancel this interview?')) {
        try {
            const { error } = await supabaseClient
                .from('interviews')
                .update({ status: 'cancelled' })
                .eq('interview_id', interviewId);

            if (error) throw error;

            // Reload dashboard data
            await loadDashboardData();
            alert('Interview cancelled successfully');

        } catch (error) {
            console.error('Error cancelling interview:', error);
            alert('Failed to cancel interview. Please try again.');
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired, calling initializeDashboard');
    initializeDashboard();
});
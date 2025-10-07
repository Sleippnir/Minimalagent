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
 * Initialize the HR dashboard, authenticate the user, and load dashboard data.
 *
 * Initializes the authentication state, verifies the user has HR privileges (redirecting to the login page if not authenticated or unauthorized), displays the user info, loads mock data for mock sessions or real data via Supabase for real sessions, sets up UI event listeners, and handles initialization failures by alerting the user and redirecting to the login page.
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
 * Loads interview records, updates dashboard statistics, and renders the interviews table.
 *
 * Fetches up to 100 interviews (including related applications, candidates, and job data), updates the dashboard stats, populates the interviews table, and manages loading/empty UI states. On failure, logs the error and shows an alert to the user.
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
 * Loads mock interview data into the dashboard UI for testing and development.
 *
 * Populates dashboard statistics and the interviews table with predefined sample
 * interviews, displays a loading state while simulating a short delay, and
 * alerts the user if loading fails.
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
 * Update dashboard statistic elements based on the provided interviews.
 *
 * Processes the interviews to compute total count, number scheduled for today,
 * number currently in progress, and number completed, then writes those values
 * into the corresponding dashboard DOM elements.
 *
 * @param {Array<Object>} interviews - Array of interview records.
 *   Each interview object must include:
 *     - {string|Date} scheduled_at — scheduled date/time of the interview.
 *     - {string} status — interview status (e.g., "scheduled", "in_progress", "completed", "cancelled").
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
 * Populates the interviews table element with rows representing each interview.
 *
 * Clears existing rows, shows the empty state if the array is empty, otherwise hides the empty state and appends a table row for each interview.
 * @param {Array<Object>} interviews - Array of interview records containing the data required to render each table row.
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
 * Create a table row element representing an interview with candidate, job, status, scheduled date, and action buttons.
 * @param {Object} interview - Interview record containing metadata and related application data.
 * @param {string} interview.interview_id - Unique identifier for the interview.
 * @param {string} interview.status - Interview status (e.g., 'scheduled', 'in_progress', 'completed', 'cancelled').
 * @param {string|number|Date} interview.scheduled_at - Timestamp or date string when the interview is scheduled.
 * @param {Object} [interview.applications] - Related application data.
 * @param {Object} [interview.applications.candidates] - Candidate record (expects `first_name`, `last_name`, `email`).
 * @param {Object} [interview.applications.jobs] - Job record (expects `title`).
 * @returns {HTMLTableRowElement} A `<tr>` element populated with the interview's display fields and action buttons.
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
 * Create a styled HTML badge representing an interview status.
 * @param {string} status - Status key such as 'scheduled', 'in_progress', 'completed', or 'cancelled'; any other value yields an "Unknown" badge.
 * @returns {string} An HTML string for a <span> element containing the status label and CSS classes for visual styling.
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
 * Attach click and change handlers to dashboard UI controls to enable logout, navigation, and filtering.
 *
 * Wires the logout, create-interview, calendar, and manage-candidates buttons to their respective actions
 * and binds the status and date filter controls to the table-filtering routine.
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
 * Filters the interviews table rows by the currently selected status and date, hiding rows that do not match.
 *
 * The status filter compares the row's badge text after converting it to lowercase and replacing spaces with underscores (e.g., "In Progress" -> "in_progress"). The date filter compares the row's scheduled date in `YYYY-MM-DD` format against the selected date.
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
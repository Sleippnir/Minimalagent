// Test dashboard without authentication
console.log('Dashboard Test JS loaded');

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

/**
 * Initialize the test dashboard UI and mock data for a local test session.
 *
 * Sets a test user label, loads mock dashboard data, and attaches UI event listeners.
 * Shows an alert if initialization fails.
 */
async function initializeTestDashboard() {
    console.log('initializeTestDashboard called');
    try {
        // Display user info
        userInfo.textContent = 'Test User (No Auth)';

        // Load mock dashboard data
        await loadMockDashboardData();

        // Setup event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Test dashboard initialization error:', error);
        alert('Failed to initialize test dashboard. Please refresh the page.');
    }
}

/**
 * Load and render mock interview data into the dashboard UI.
 *
 * Simulates a short loading delay, constructs a set of mock interviews, updates dashboard statistics,
 * populates the interviews table, and hides the loading indicator when finished. If an error occurs,
 * logs the error to the console and displays an alert indicating the load failed.
 */
async function loadMockDashboardData() {
    try {
        console.log('Loading mock dashboard data');
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

    } catch (error) {
        console.error('Error loading mock dashboard data:', error);
        alert('Failed to load mock dashboard data. Please refresh the page.');
    } finally {
        // Hide loading state
        if (loadingState) loadingState.style.display = 'none';
    }
}

/**
 * Compute dashboard counts from the provided interviews and update the corresponding UI elements.
 *
 * Counts updated:
 * - total interviews
 * - interviews scheduled for today (local date)
 * - interviews with status 'in_progress'
 * - interviews with status 'completed'
 *
 * @param {Array<Object>} interviews - Array of interview records. Each object must include:
 *   - {string} scheduled_at - ISO datetime string for the scheduled time.
 *   - {string} status - One of the status keys (e.g., 'scheduled', 'in_progress', 'completed', 'cancelled').
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
 * Populate the interviews table element with the provided interview entries and update the empty-state visibility.
 *
 * Clears any existing rows, shows the empty state when the list is empty, and otherwise creates and appends a table row for each interview.
 *
 * @param {Array<Object>} interviews - Array of interview objects to render. Each object is expected to include properties such as `interview_id`, `status`, `scheduled_at`, and `applications` (with candidate/job details).
 */
function populateInterviewsTable(interviews) {
    console.log('populateInterviewsTable called with', interviews.length, 'interviews');
    interviewsTableBody.innerHTML = '';

    if (interviews.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    interviews.forEach((interview, index) => {
        console.log('Creating row for interview', index, interview);
        const row = createInterviewRow(interview);
        interviewsTableBody.appendChild(row);
    });

    console.log('Table populated with', interviews.length, 'rows');
}

/**
 * Create a table row element representing an interview for insertion into the interviews table.
 *
 * Populates candidate name and email, job title, status badge, scheduled date, and action buttons
 * (View, Edit, Cancel) wired to global handlers. Missing candidate/job fields fall back to 'Unknown'.
 *
 * @param {Object} interview - Interview record.
 * @param {string} interview.interview_id - Unique interview identifier used by action handlers.
 * @param {string} interview.status - Interview status key (e.g., 'scheduled', 'in_progress', 'completed', 'cancelled').
 * @param {string|number|Date} interview.scheduled_at - Scheduled date/time for the interview (parsable by Date).
 * @param {Object} [interview.applications] - Associated application data.
 * @param {Object} [interview.applications.candidates] - Candidate details.
 * @param {string} [interview.applications.candidates.first_name]
 * @param {string} [interview.applications.candidates.last_name]
 * @param {string} [interview.applications.candidates.email]
 * @param {Object} [interview.applications.jobs] - Job details.
 * @param {string} [interview.applications.jobs.title]
 * @returns {HTMLTableRowElement} A table row (<tr>) element populated with the interview's display data and action buttons.
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
 * Produce an HTML badge for an interview status.
 *
 * @param {string} status - Status key such as "scheduled", "in_progress", "completed", or "cancelled"; unrecognized values render an "Unknown" badge.
 * @returns {string} An HTML `<span>` string styled as a colored status badge containing the human-readable status text.
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
 * Attach click and change handlers to dashboard UI controls to enable navigation, placeholder actions, and filtering.
 *
 * Wires the following elements:
 * - logoutBtn: navigates back to the manager login page.
 * - createInterviewBtn: navigates to the interview creation page.
 * - viewCalendarBtn: shows a placeholder alert for calendar view.
 * - manageCandidatesBtn: shows a placeholder alert for candidate management.
 * - statusFilter and dateFilter: trigger filtering of the interviews table when changed.
 */
function setupEventListeners() {
    // Logout (back to login)
    logoutBtn.addEventListener('click', () => {
        window.location.href = '../manager_login.html';
    });

    // Create interview
    createInterviewBtn.addEventListener('click', () => {
        window.location.href = '../interview_creation.html';
    });

    // View calendar
    viewCalendarBtn.addEventListener('click', () => {
        alert('Calendar view coming soon!');
    });

    // Manage candidates
    manageCandidatesBtn.addEventListener('click', () => {
        alert('Candidate management coming soon!');
    });

    // Filters
    statusFilter.addEventListener('change', filterInterviews);
    dateFilter.addEventListener('change', filterInterviews);
}

/**
 * Filters visible interview rows in the table according to the selected status and date filters.
 *
 * Reads the current values of the status and date filter controls and hides rows whose
 * interview status or scheduled date do not match the selected values.
 *
 * Matching details:
 * - Status comparison normalizes the row badge text by lowercasing and replacing spaces with underscores (e.g., "In Progress" -> "in_progress").
 * - Date comparison converts the row's date cell to an ISO date string (YYYY-MM-DD) and compares it to the date filter value.
 *
 * Side effects:
 * - Toggles each row's visibility by setting its style.display to '' (show) or 'none' (hide).
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

    alert('Real interview cancellation not implemented in test mode');
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded fired, calling initializeTestDashboard');
    initializeTestDashboard();
});</content>
<parameter name="filePath">c:\Projects\GitHub\Minimalagent\frontend\hr\dashboard-test.html
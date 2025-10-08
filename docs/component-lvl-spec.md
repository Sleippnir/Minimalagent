# Component-Level Specification

This document describes the React frontend that powers both the HR console and the candidate portal. Each section groups components by their role in the application and summarises state, props, and noteworthy behaviours so the spec stays aligned with the current codebase.

## 1. Entry Points & Context

### SupabaseContext.jsx

- Creates a Supabase client with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. If the environment variables are missing it returns `null` and logs a warning; downstream components fall back to mock data in that case.
- Exports `SupabaseProvider` (context provider) and `useSupabase` (hook that throws if used outside the provider).

### main.jsx

- Mounts `<App />` inside `React.StrictMode` and imports the global stylesheet.
- Used for the internal HR console bundle.

### main-candidate.jsx

- Mounts the public-facing `<CandidatePortal />` wrapped in `<SupabaseProvider>` and reuses the shared stylesheet.
- Compiled into a separate entry for the candidate portal experience.

## 2. Core Application Shell

### App.jsx

- Root component for the HR console. Wraps all routes in `SupabaseProvider`.
- Tracks `currentView` in local state (`dashboard`, `interviews`, `candidates`, `evaluations`) and renders the matching view component.
- Renders the top navigation and delegates actual content to the view components below.

## 3. HR Console Views

### DashboardView.jsx

- Dependencies: `useSupabase`, `StatCard`, `RecentInterviews`, `InterviewStatusChart`, `ModelPerformanceChart`, `WeeklyActivityChart`, `MetricsSummary`, `Spinner`, `Toast`.
- State: `stats`, `recentInterviews`, `metrics`, `chartData`, `loading`, `toast`.
- Behaviour:
  - On mount calls `fetchDashboardData()`. When Supabase is not configured it seeds representative mock data so the UI still renders.
  - For live data it fetches interview statuses, recent interviews (with prompt/rubric joins), evaluation metrics, and chart inputs in parallel.
  - Displays four top-level `StatCard`s, a recent interview list, three charts, and a condensed metrics panel. Errors surface through `Toast`.

### InterviewsView.jsx

- Dependencies: `useSupabase`, `Spinner`, `Toast`, `SearchableDropdown`, `QuestionManager`, `InterviewSummary`.
- State splits into three groups:
  - Loading & UX: `loading`, `submitting`, `toast`, `showCandidateModal`, `showInspectModal`, `inspectContent`, `inspectTitle`.
  - Form selections: `formData` (`candidate`, `job`, `resume`, `questions`, `interviewerPrompt`, `evaluatorPrompt`, `rubric`).
  - Cached lookup data: `data` (`candidates`, `jobs`, `questions`, `prompts`, `rubrics`, `resumes`) plus `candidateFormData` for the “Add candidate” modal.
- Behaviour highlights:
  - On mount fetches all dropdown data (or mock payloads when Supabase is absent) and default-selects the latest interviewer/evaluator prompt versions and rubric.
  - Provides a modal to create candidates inline, including resume upload to Supabase Storage. Uploaded resumes update both the candidate record and form state.
  - `handleInspect` opens a modal showing prompt or rubric contents using additional Supabase queries.
  - On submit it upserts an `applications` record and calls the `schedule-interview` Supabase Edge Function with the selected prompt, rubric, questions, and optional resume path.

### CandidatesView.jsx

- Dependencies: `useSupabase`, `Spinner`, `Toast`.
- State: `candidates`, `loading`, `showModal`, `submitting`, `toast`, `editingCandidate`, `formData` for the modal fields.
- Behaviour:
  - Loads all candidates (or mock data) on mount and displays them in a glassmorphic table.
  - “Add Candidate” button opens a modal used for both create and edit flows; edits pre-fill the form and update via Supabase `update` calls.
  - Success and failure paths surface through `Toast`; a spinner covers the initial load.

### EvaluationsView.jsx

- Dependencies: `useSupabase`, `Spinner`, `SearchableDropdown`, internal helper components `EvaluationDetailView` and `EvaluationDetailsRenderer`.
- State: `evaluations`, `jobs`, `candidates`, `filteredEvaluations`, `filteredCandidates`, `selectedJob`, `selectedCandidate`, `loading`.
- Behaviour:
  - On mount fetches evaluation records (joined to interviews, applications, jobs, and candidates), job list, and candidate list; the component falls back to hard-coded sample data when Supabase is not available.
  - Filters: selecting a job narrows the candidate list, and selecting a candidate reveals their evaluation tabs. “Clear Filters” resets both selections.
  - `EvaluationDetailView` renders tabbed results for each AI model evaluation and leverages `EvaluationDetailsRenderer` to format the JSON payloads (supports both legacy and new structured schemas).

## 4. Candidate Experience

### CandidatePortal.jsx

- Dependencies: `useSupabase`, `Spinner`, `Toast`.
- State: `email`, `candidate`, `interviews`, `currentInterview`, `loading`, `toast`.
- Behaviour:
  - Login form looks up the candidate by email. When Supabase is absent it recognises `john@example.com` and returns mock interviews.
  - Once authenticated it lists interviews with status chips and provides buttons to launch scheduled interviews (`fetch /api/interviews/{token}?launch_bot=true`) or view results (placeholder).
  - `currentInterview` toggles an in-app session view; because the live video integration is not yet shipped the session simply shows a placeholder message and a “Back to Portal” button.

### InterviewSession.jsx

- Currently not wired into the portal while video interviews are hosted elsewhere, but the component is kept for future integration.
- Manages screen transitions (intro, intro video, interview) and would coordinate Pipecat audio/video clients; all connection logic is stubbed out with explanatory comments.

## 5. Shared Components

### SearchableDropdown.jsx

- Props: `label`, `options`, `value`, `onChange`, `displayKey` (string or function), optional `placeholder`, `extraButton` slot.
- Maintains `isOpen` and `search` state, filters options via `displayKey`, and supports custom trailing controls (e.g., “Inspect” buttons in the interview form).

### QuestionManager.jsx

- Props: `questions`, `selectedQuestions`, `onChange`.
- Local state for text filter and category filter; reuses `SearchableDropdown` to pick categories.
- Displays available questions with tags, allows toggling selection, and lists chosen questions with remove buttons.

### InterviewSummary.jsx

- Props: `formData`, `data` (unused today but available for future enrichment).
- Presents a summary of the selections from `InterviewsView` (candidate, job, resume presence, counts, prompt/rubric names).

### StatCard.jsx

- Props: `icon`, `color`, `title`, `value`, optional `className`.
- Maps logical colour names to Tailwind classes and renders the small metric cards used on the dashboard.

### RecentInterviews.jsx

- Props: `interviews`, optional `className`.
- Renders the latest interviews with candidate initials, job title, status chips, prompt/rubric metadata, and creation date. Falls back to an empty state message when no data is supplied.

### MetricsSummary.jsx

- Props: `completionRate`, `pendingEvaluations`.
- Provides a compact two-card panel for the dashboard metrics column.

### charts/InterviewStatusChart.jsx

- Props: `data`, optional `height` and `className`.
- Wraps a `recharts` pie chart with custom tooltip/legend styling and skips rendering when the dataset is empty.

### charts/ModelPerformanceChart.jsx

- Props: `data`, optional `height` and `className`.
- Renders a bar chart of evaluation model performance; colours are inferred from the model name (`gpt`, `claude`, `gemini`, `deepseek`, etc.).

### charts/WeeklyActivityChart.jsx

- Props: `data`, optional `height` and `className`.
- Displays interviews vs. evaluations over the week using a dual-line chart.

### Toast.jsx

- Props: `message`, `type` (`success` | `error`), `onClose`.
- Auto-dismisses after 5 seconds, exposes a manual close button, and applies contextual styling based on the toast type.

### Spinner.jsx

- No props. Displays a centred animated spinner used while data is loading.

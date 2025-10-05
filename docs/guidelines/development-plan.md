# Development Plan & To-Do List

This document provides a step-by-step plan for building the HR AI Assistant frontend.

## Phase 0: Project Setup & Configuration

- [ ] **Verify Dependencies:** Ensure all dependencies listed in `/frontend/package.json` are installed by running `npm install` or `yarn` in the `/frontend` directory.

- [ ] **Environment Setup:**
  - [ ] Create a file named `.env.local` inside the `/frontend` directory.
  - [ ] Add the following two lines to this file, replacing the placeholders with the actual Supabase credentials:
    ```
    VITE_SUPABASE_URL="YOUR_SUPABASE_URL_HERE"
    VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY_HERE"
    ```

- [ ] **Application Entrypoint:**
  - [ ] Create the main application directory structure: `/frontend/dashboards/hr/src/`.
  - [ ] Create the root component `App.jsx` and the main entry file `main.jsx` inside the src directory.

- [ ] **Supabase Client Initialization:**
  - [ ] Create a Supabase context provider (`SupabaseContext.js`) that initializes the client using the `VITE_` environment variables and provides the client instance to the entire application. This replaces the legacy `/frontend/js/config/supabase.js`.

## Phase 1: Core Interview Creation View (MVP)

**Goal:** Build the complete form for scheduling an interview as defined in `component-lvl-spac.md`.

- [ ] **Build Components:** Create the individual React components: `InterviewsView`, `SearchableDropdown`, `QuestionManager`, `InterviewSummary`, `Spinner`, `Toast`.

- [ ] **Initial Data Fetch:** In the `InterviewsView` component, implement the `fetchInterviewFormData` logic to fetch candidates, jobs, questions, prompts, and rubrics concurrently on component mount. Display a `Spinner` while loading.

- [ ] **Resume Upload Logic:** Implement the file input handler that uploads the selected PDF to Supabase Storage at the `/resumes/` path and stores the returned path in the component's state.

- [ ] **Form State Management:** Wire up all form inputs and selections to the `InterviewsView` component's state, ensuring the `InterviewSummary` updates in real-time.

- [ ] **Invoke Edge Function:** Create the `handleScheduleInterview` function that is triggered on form submission. This function will:
  - Perform basic validation to ensure all required fields are filled.
  - Display a `Spinner` or disable the button to prevent multiple submissions.
  - Call `supabase.functions.invoke('schedule-interview', ...)` with the correct `interview_id`.
  - On success, display a success `Toast` notification and reset the form.
  - On error, display an error `Toast` notification.

## Phase 2: Dashboard & Candidate Views

**Goal:** Build the supporting views for context and data management.

- [ ] **Dashboard View:**
  - [ ] Build the `DashboardView` component.
  - [ ] Implement the `fetchDashboardStats` function to get aggregate counts from the `interviews` table.
  - [ ] Implement the `fetchRecentInterviews` function to get the 10 most recent interviews, joining with candidate and job data.
  - [ ] Display a `Spinner` while data is loading.

- [ ] **Candidate Management View:**
  - [ ] Build the `CandidatesView` component.
  - [ ] Fetch and display all candidates in a table.
  - [ ] Implement the "Add Candidate" modal with a form.
  - [ ] Write the submission logic to insert a new record into the `candidates` table and refresh the view.

## Phase 3: Polish & Refinement

- [ ] **Styling:** Thoroughly apply Tailwind CSS classes to all components to match the design of `hr_intervieww.html`.

- [ ] **Responsiveness:** Test and refine the layout across various screen sizes, from mobile to desktop.

- [ ] **Error Handling:** Ensure all try/catch blocks around Supabase calls are robust and provide meaningful feedback to the user.

- [ ] **Code Cleanup:** Refactor any repetitive code and ensure component props are clearly defined.
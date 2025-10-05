# Component-Level Specification

This document outlines the architecture of the React frontend, breaking the UI into a hierarchy of components.

## 1. Global Setup & Context

### SupabaseContext.js
**Purpose:** To initialize the Supabase client once and make it available to the entire application using React's Context API.

**Exports:**
- `SupabaseProvider` (wrapper component)
- `useSupabase` (custom hook to access the client)

## 2. Core Application Shell

### App.jsx
**Purpose:** The root component. Manages the main application layout, navigation, and active view.

**State:**
- `activeView` (string): Stores the currently displayed view ('dashboard', 'interviews', 'candidates'). Defaults to 'dashboard'.

**Behavior:**
- Renders the main header and navigation tabs.
- Conditionally renders the `DashboardView`, `InterviewsView`, or `CandidatesView` component based on the `activeView` state.
- Wraps the entire application in the `SupabaseProvider`.

## 3. View-Level Components

### DashboardView.jsx
**Purpose:** To display at-a-glance statistics and recent activity.

**Props:** None.

**State:**
- `stats` (object | null): Stores the aggregate counts `{ total: 0, completed: 0, evaluated: 0 }`.
- `recentInterviews` (array | null): Stores the list of the 10 most recent interviews.
- `isLoading` (boolean): Tracks the data fetching state.

**Behavior:**
- On component mount, invokes the `fetchDashboardStats` and `fetchRecentInterviews` functions as defined in the TODO.md.
- Displays a `Spinner` while `isLoading` is true.
- Renders three `StatCard` components, passing the relevant numbers from the `stats` state.
- Renders the `RecentInterviewsTable` component, passing the `recentInterviews` data as a prop.

### InterviewsView.jsx
**Purpose:** Contains the multi-step form for scheduling a new interview. This is the most complex component.

**Props:** None.

**State:**
- **Form Data Cache:**
  - `candidates` (array): Full list of candidates.
  - `jobs` (array): Full list of jobs.
  - `questions` (array): Full list of questions.
  - `prompts` (array): Full list of prompts.
  - `rubrics` (array): Full list of rubrics.
- **Form Selections:**
  - `selectedCandidate` (object | null)
  - `selectedJob` (object | null)
  - `uploadedResumeFile` (File | null)
  - `selectedQuestions` (array)
  - `selectedInterviewerPrompt` (object | null)
  - `selectedEvaluatorPrompt` (object | null)
  - `selectedRubric` (object | null)
- **UI State:**
  - `isLoading` (boolean): For the initial data fetch.
  - `isSubmitting` (boolean): For the submission process.

**Behavior:**
- On component mount, fetches all data required for the form dropdowns (`fetchInterviewFormData`).
- Renders child components for each section of the form (`SearchableDropdown`, `FileUpload`, `QuestionManager`).
- Renders the `InterviewSummary` component, passing all `selected*` state values as props.
- Handles the "Schedule Interview" button click, which triggers form validation and invokes the `schedule-interview` Supabase function. Displays a `Toast` on success or failure.

### CandidatesView.jsx
**Purpose:** To display all candidates and allow for the creation of new ones.

**Props:** None.

**State:**
- `allCandidates` (array | null)
- `isLoading` (boolean)
- `isModalOpen` (boolean)

**Behavior:**
- Fetches all candidates from the `candidates` table on mount.
- Renders the `CandidatesTable` component.
- Handles the "Add Candidate" button click to toggle the `isModalOpen` state.
- Conditionally renders the `AddCandidateModal`.

## 4. Reusable & Child Components

### SearchableDropdown.jsx
**Purpose:** A reusable dropdown with a text input that filters the list of options.

**Props:**
- `options` (array of objects): The full list of items to display (e.g., all candidates).
- `label` (string): The form label text.
- `onSelect` (function): A callback function that returns the selected object to the parent.
- `displayKey` (string): The key in the option object to display in the list (e.g., 'first_name').

**State:**
- `searchTerm` (string): The value of the text input.
- `filteredOptions` (array): The options list filtered by the `searchTerm`.
- `isOpen` (boolean): Controls the visibility of the dropdown list.

### QuestionManager.jsx
**Purpose:** To allow users to select questions from a master list.

**Props:**
- `allQuestions` (array)
- `onChange` (function): A callback that returns the array of selected questions to the parent.

**State:**
- `filter` (string): The currently selected category ('Behavioral', 'Technical', 'All').
- `availableQuestions` (array): The filtered list of questions not yet selected.
- `selectedQuestions` (array): The list of questions the user has chosen.

**Behavior:**
- Displays two columns: "Available Questions" and "Selected Questions".
- Allows adding a question from the available list to the selected list and vice-versa.
- Calls the `onChange` prop whenever the `selectedQuestions` list is modified.

### InterviewSummary.jsx
**Purpose:** A read-only component that displays all user selections from the main form.

**Props:** Receives all `selected*` objects from `InterviewsView` (e.g., `selectedCandidate`, `selectedJob`, etc.).

**Behavior:**
- Displays the selected information in a clear, formatted way.
- Implements hover/click popups to show the full text of the Job Description, Prompts, and Rubric.

### Toast.jsx
**Purpose:** A small notification that appears in the corner of the screen.

**Props:**
- `message` (string)
- `type` ('success' | 'error')
- `isVisible` (boolean)

### Spinner.jsx
**Purpose:** A simple loading indicator.

**Props:** None. Renders a CSS-based spinner.
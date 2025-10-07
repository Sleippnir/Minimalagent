# Product Requirements Document (PRD)

## HR AI-Powered Interview Assistant

### 1. Introduction & Vision

This document outlines the requirements for the HR AI-Powered Interview Assistant. The vision is to create a web-based, single-page application (SPA) that enables HR personnel to seamlessly schedule, configure, and initiate AI-driven interviews. The tool will serve as the primary interface for managing the pre-interview workflow, leveraging a Supabase backend for data persistence and serverless logic.

### 2. Target Users

- **HR Coordinators:** Primary users responsible for scheduling interviews and managing candidate data.
- **Hiring Managers:** Will use the dashboard to track interview progress and view results (future functionality).

### 3. Key Features (MVP)

- **Central Dashboard:** A landing page displaying high-level statistics (e.g., total interviews scheduled, pending evaluations) and a list of recent activity.

- **Interview Scheduling Form:** A comprehensive interface to create and schedule a new AI interview. This includes:
  - Selection of a candidate and job position from a searchable list.
  - Uploading a candidate's PDF resume directly to Supabase Storage.
  - Building an interview script by selecting questions from a master list, filterable by category (Behavioral, Technical).
  - Configuration of the AI by selecting the appropriate Interviewer Prompt, Evaluator Prompt, and Evaluation Rubric.
  - A real-time summary view of the configured interview before submission.

- **Candidate Management:** A simple view to list all candidates in the database and a modal form to add a new candidate.

### 4. Technical Architecture & Environment

- **Frontend Framework:** React 18 with Vite. All development work will occur within the `/frontend/dashboards/hr/` directory, with source files likely in a `/frontend/dashboards/hr/src` subdirectory.

- **Styling:** Tailwind CSS. The visual design and component styling must adhere to the aesthetic established in `/frontend/dashboards/hr/guidelines/hr_intervieww.html`.

- **Backend:** Supabase.

- **Database:** The schema is defined in `/frontend/dashboards/hr/guidelines/supabase-tables.md`.

- **Storage:** Resumes are to be uploaded to the `/resumes/` path in the designated Supabase Storage bucket.

- **Edge Function:** The core transaction is handled by the `schedule-interview` function located at `/supabase/functions/schedule-interview/index.ts`.

- **Configuration:**
  - The React application will be configured via a `.env.local` file placed at the root of the `/frontend` directory.
  - This file will contain `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
  - The legacy configuration files at `/frontend/js/config/` will not be used. Supabase client initialization will be handled within the React application's context provider.

- **Component Design:** The specific breakdown of React components, their props, and their state is defined in `/frontend/dashboards/hr/guidelines/component-lvl-spac.md`.

### 5. Non-Functional Requirements

- **Responsiveness:** The application must be fully responsive and usable on both desktop and mobile devices.

- **User Feedback:** All asynchronous operations (data fetching, file uploading, form submission) must provide clear visual feedback to the user, including loading states (spinners) and success/error messages (toast notifications).
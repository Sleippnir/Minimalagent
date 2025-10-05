# HR Dashboard Components Documentation

This document describes the reusable React components from the HR Dashboard, located in `frontend/dashboards/hr/src/components/`. These components are designed to be modular and can be reused in other dashboards.

## Overview

The HR Dashboard is built with React and uses the following key components:

- **SupabaseContext**: Provides Supabase client instance
- **App**: Main application with navigation
- **DashboardView**: Statistics and overview
- **InterviewsView**: Interview scheduling form
- **CandidatesView**: Candidate management
- **QuestionManager**: Question selection interface
- **InterviewSummary**: Interview details display
- **SearchableDropdown**: Reusable searchable select component
- **Spinner**: Loading indicator
- **Toast**: Notification system

## Component Details

### SupabaseContext (`SupabaseContext.jsx`)

**Purpose**: Provides Supabase client instance to child components via React Context.

**Usage**:

```jsx
import { SupabaseProvider, useSupabase } from './SupabaseContext.jsx'

function App() {
  return (
    <SupabaseProvider>
      <YourComponents />
    </SupabaseProvider>
  )
}

function ChildComponent() {
  const supabase = useSupabase()
  // Use supabase client
}
```

**Dependencies**: @supabase/supabase-js

### App (`App.jsx`)

**Purpose**: Main application component with navigation between different views.

**State**:

- `currentView`: Current active view ('dashboard', 'interviews', 'candidates')

**Views**:

- DashboardView
- InterviewsView
- CandidatesView

**Styling**: Uses Tailwind CSS classes for glass UI effect.

### DashboardView (`DashboardView.jsx`)

**Purpose**: Displays overview statistics and recent interviews.

**Features**:

- Fetches dashboard stats (total, scheduled, completed, evaluated interviews)
- Shows recent interviews list
- Handles both Supabase data and mock data for development

**State**:

- `stats`: Object with interview counts
- `recentInterviews`: Array of recent interview objects
- `loading`: Boolean for loading state

### InterviewsView (`InterviewsView.jsx`)

**Purpose**: Form for scheduling new AI-powered interviews.

**Features**:

- Candidate selection (with add new option)
- Job position selection
- Resume upload/selection
- Question selection via QuestionManager
- Prompt and rubric selection
- Interview summary
- Form validation and submission

**State**:

- `formData`: Interview form data
- `data`: Fetched options (candidates, jobs, questions, prompts, rubrics)
- `loading`, `submitting`: UI states
- `toast`: Notification state
- `showCandidateModal`: Modal for adding candidates

**Dependencies**: Uses SupabaseContext, SearchableDropdown, QuestionManager, InterviewSummary, Toast

### CandidatesView (`CandidatesView.jsx`)

**Purpose**: Table view for managing candidates with add/edit functionality.

**Features**:

- Displays candidates in a table
- Add new candidate modal
- Edit existing candidate (contact info only, names disabled)
- Form validation

**State**:

- `candidates`: Array of candidate objects
- `loading`: Boolean
- `showModal`: Boolean for modal visibility
- `editingCandidate`: Currently editing candidate object
- `formData`: Form data for add/edit
- `submitting`: Boolean
- `toast`: Notification

**Table Columns**: Name, Email, Phone, LinkedIn, Actions

### QuestionManager (`QuestionManager.jsx`)

**Purpose**: Interface for selecting and managing interview questions.

**Features**:

- Text search for questions
- Category filtering
- Checkbox selection of questions
- Selected questions summary with remove option

**Props**:

- `questions`: Array of question objects
- `selectedQuestions`: Array of selected question objects
- `onChange`: Callback for selection changes

**State**:

- `filter`: Search text
- `categoryFilter`: Selected category

### InterviewSummary (`InterviewSummary.jsx`)

**Purpose**: Displays summary of selected interview parameters.

**Props**:

- `formData`: Interview form data
- `data`: Options data for lookups

**Displays**:

- Selected candidate, job, resume
- Selected questions count
- Selected prompts and rubric

### SearchableDropdown (`SearchableDropdown.jsx`)

**Purpose**: Reusable dropdown component with search functionality.

**Props**:

- `label`: String label
- `options`: Array of option objects
- `value`: Currently selected option
- `onChange`: Callback for selection
- `displayKey`: Function or string for display text
- `placeholder`: Placeholder text

**Features**:

- Type-to-search input
- Filtered options list
- Click outside to close

### Spinner (`Spinner.jsx`)

**Purpose**: Loading indicator component.

**Usage**:

```jsx
<Spinner />
```

**Styling**: Centered spinner with Tailwind classes.

### Toast (`Toast.jsx`)

**Purpose**: Notification component for success/error messages.

**Props**:

- `message`: String message
- `type`: 'success' or 'error'
- `onClose`: Callback to dismiss

**Usage**:

```jsx
<Toast message="Success!" type="success" onClose={() => setToast(null)} />
```

## Styling

All components use Tailwind CSS with custom glass UI theme:

- `glass-ui`: Semi-transparent background with blur
- `btn-primary`: Primary button styling
- `btn-secondary`: Secondary button styling
- `form-input`: Input field styling

## Data Structure

### Candidate

```javascript
{
  candidate_id: string,
  first_name: string,
  last_name: string,
  email: string,
  phone: string,
  linkedin_url: string,
  resume_path: string
}
```

### Job

```javascript
{
  job_id: string,
  title: string,
  description: string,
  required_tags: string[]
}
```

### Question

```javascript
{
  question_id: string,
  text: string,
  ideal_answer: string,
  category: string,
  tags: string[]
}
```

### Prompt

```javascript
{
  prompt_id: string,
  name: string,
  purpose: 'interviewer' | 'evaluator'
}
```

### Rubric

```javascript
{
  rubric_id: string,
  name: string
}
```

## Dependencies

- React 18+
- @supabase/supabase-js
- lucide-react (for icons)
- Tailwind CSS

## Setup

1. Copy component files to new dashboard
2. Ensure SupabaseContext is set up
3. Import and use components as needed
4. Adjust styling and data fetching for specific use cases

## Notes

- Components handle both Supabase data and mock data for development
- Error handling is built-in with toast notifications
- Form validation prevents invalid submissions
- Components are designed to be responsive with Tailwind's responsive classes
</content>
<parameter name="filePath">c:\Projects\GitHub\Minimalagent\frontend\dashboards\hr\guidelines\components.md

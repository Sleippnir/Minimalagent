# Frontend Refactoring TODOs

## Raw Findings

1. **Large Components Issue**: DashboardView.jsx (380 lines), InterviewsView.jsx (660 lines), CandidatesView.jsx (309 lines), EvaluationsView.jsx (519 lines) are too large and handle multiple responsibilities (data fetching, rendering, state management). Should be split into smaller, focused components.

2. **Extract RubricViewer Component**: RubricViewer is defined inside InterviewsView.jsx. Move to separate file for reusability.

3. **Extract EvaluationDetailsRenderer Component**: EvaluationDetailsRenderer is defined inside EvaluationsView.jsx. Move to separate file.

4. **NavButton Component**: App.jsx has repeated className logic for nav buttons. Create a reusable NavButton component.

5. **Dashboard Data Hook**: DashboardView has multiple async functions for fetching data. Extract into useDashboardData hook.

6. **Interview Scheduling Hook**: InterviewsView has complex form logic. Extract into useInterviewScheduling hook.

7. **Candidate Management Hook**: CandidatesView has CRUD logic. Extract into useCandidateManagement hook.

8. **Mock Data Centralization**: Mock data is scattered across components. Create a centralized mock data provider or utility.

9. **Model Performance Calculation Redundancy**: Logic for calculating model performance is duplicated in DashboardView (fetchChartData and fetchMetricsData).

10. **Video-Client Integration**: video-client is a separate app. Consider shared components or integration with main app.

11. **Candidate Portal Expansion**: candidate/ folder is minimal. May need more components if expanded.

12. **Error Handling Consistency**: Error handling patterns vary across components. Standardize with custom hooks.

13. **Loading States**: Multiple components have similar loading state logic. Could use a generic loading wrapper.

14. **Form Validation**: Form validation in InterviewsView is inline. Extract to custom hook or utility.

15. **Toast Notifications**: Toast logic is repeated. Could use a global toast context.

## Categorized and Scored Findings

### Codependent Issues

- **Extract RubricViewer Component** (Ease: 2, Impact: 3, Ratio: 1.5) - Depends on rubric data structure.
- **Extract EvaluationDetailsRenderer Component** (Ease: 2, Impact: 3, Ratio: 1.5) - Depends on evaluation data format.
- **Dashboard Data Hook** (Ease: 3, Impact: 4, Ratio: 1.33) - Requires splitting DashboardView.
- **Interview Scheduling Hook** (Ease: 4, Impact: 4, Ratio: 1.0) - Complex form logic extraction.
- **Candidate Management Hook** (Ease: 3, Impact: 3, Ratio: 1.0) - CRUD operations.

Average category score: (1.5 + 1.5 + 1.33 + 1.0 + 1.0) / 5 = 1.266

### Refactors

- **Large Components Issue** (Ease: 4, Impact: 5, Ratio: 1.25) - Breaking down giants.
- **NavButton Component** (Ease: 1, Impact: 2, Ratio: 2.0) - Simple extraction.
- **Mock Data Centralization** (Ease: 2, Impact: 3, Ratio: 1.5) - Organize dev data.
- **Model Performance Calculation Redundancy** (Ease: 2, Impact: 3, Ratio: 1.5) - DRY principle.
- **Video-Client Integration** (Ease: 5, Impact: 4, Ratio: 0.8) - Architecture change.
- **Candidate Portal Expansion** (Ease: 3, Impact: 2, Ratio: 0.67) - Future-proofing.
- **Error Handling Consistency** (Ease: 3, Impact: 3, Ratio: 1.0) - Standardization.
- **Loading States** (Ease: 2, Impact: 2, Ratio: 1.0) - UI consistency.
- **Form Validation** (Ease: 3, Impact: 3, Ratio: 1.0) - Reusability.
- **Toast Notifications** (Ease: 2, Impact: 3, Ratio: 1.5) - Global state.

Average category score: (1.25 + 2.0 + 1.5 + 1.5 + 0.8 + 0.67 + 1.0 + 1.0 + 1.0 + 1.5) / 10 = 1.222

### How Would a Developer Do It

- **Custom Hooks for Data Fetching** (Ease: 3, Impact: 4, Ratio: 1.33) - Best practice.
- **Component Composition** (Ease: 3, Impact: 4, Ratio: 1.33) - Modular design.
- **Separation of Concerns** (Ease: 4, Impact: 5, Ratio: 1.25) - Clean architecture.
- **Reusable UI Components** (Ease: 2, Impact: 3, Ratio: 1.5) - DRY.
- **State Management Strategy** (Ease: 4, Impact: 4, Ratio: 1.0) - Scalability.

Average category score: (1.33 + 1.33 + 1.25 + 1.5 + 1.0) / 5 = 1.282

## Ordered Categories by Average Score

1. How Would a Developer Do It (1.282)
2. Codependent Issues (1.266)
3. Refactors (1.222)

## Final Ordered TODOs

TODO 01-01: Reusable UI Components (Ease: 2, Impact: 3, Ratio: 1.5) - How Would a Developer Do It
TODO 01-02: Custom Hooks for Data Fetching (Ease: 3, Impact: 4, Ratio: 1.33) - How Would a Developer Do It
TODO 01-03: Component Composition (Ease: 3, Impact: 4, Ratio: 1.33) - How Would a Developer Do It
TODO 01-04: Separation of Concerns (Ease: 4, Impact: 5, Ratio: 1.25) - How Would a Developer Do It
TODO 01-05: State Management Strategy (Ease: 4, Impact: 4, Ratio: 1.0) - How Would a Developer Do It

TODO 02-01: Extract RubricViewer Component (Ease: 2, Impact: 3, Ratio: 1.5) - Codependent Issues
TODO 02-02: Extract EvaluationDetailsRenderer Component (Ease: 2, Impact: 3, Ratio: 1.5) - Codependent Issues
TODO 02-03: Dashboard Data Hook (Ease: 3, Impact: 4, Ratio: 1.33) - Codependent Issues
TODO 02-04: Interview Scheduling Hook (Ease: 4, Impact: 4, Ratio: 1.0) - Codependent Issues
TODO 02-05: Candidate Management Hook (Ease: 3, Impact: 3, Ratio: 1.0) - Codependent Issues

TODO 03-01: NavButton Component (Ease: 1, Impact: 2, Ratio: 2.0) - Refactors
TODO 03-02: Toast Notifications (Ease: 2, Impact: 3, Ratio: 1.5) - Refactors
TODO 03-03: Mock Data Centralization (Ease: 2, Impact: 3, Ratio: 1.5) - Refactors
TODO 03-04: Model Performance Calculation Redundancy (Ease: 2, Impact: 3, Ratio: 1.5) - Refactors
TODO 03-05: Large Components Issue (Ease: 4, Impact: 5, Ratio: 1.25) - Refactors
TODO 03-06: Error Handling Consistency (Ease: 3, Impact: 3, Ratio: 1.0) - Refactors
TODO 03-07: Form Validation (Ease: 3, Impact: 3, Ratio: 1.0) - Refactors
TODO 03-08: Loading States (Ease: 2, Impact: 2, Ratio: 1.0) - Refactors
TODO 03-09: Video-Client Integration (Ease: 5, Impact: 4, Ratio: 0.8) - Refactors
TODO 03-10: Candidate Portal Expansion (Ease: 3, Impact: 2, Ratio: 0.67) - Refactors

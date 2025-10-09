# Frontend Refactor Opportunities

**Scoring rubric**
- Ease levels (E1-E5): E5 Very Easy, E4 Easy, E3 Moderate, E2 Hard, E1 Very Hard.
- Impact levels (I1-I5): I1 Minimal, I2 Low, I3 Moderate, I4 High, I5 Critical.
- Priority score = ImpactScore / (6 - EaseScore). Higher scores mean better ease-to-impact ratio.

## Interview Scheduling Workflow (Avg Priority 1.416)
| Task ID | Description | Ease | Impact | Priority Score | Dependencies / Notes |
| --- | --- | --- | --- | --- | --- |
| ISW-4 | Move the prompt/rubric label helpers from `frontend/src/components/InterviewsView.jsx` into a shared utility consumed by `InterviewSummary.jsx` and related views to stop duplication. | E5 Very Easy | I2 Low | 2.00 | Unblocks ISW-3 by giving the shared component a single import site. |
| ISW-3 | Promote the inline `RubricViewer` in `InterviewsView.jsx` to `frontend/src/components/RubricViewer.jsx` so rubric previews can be reused in `EvaluationsView.jsx` and inspection modals. | E4 Easy | I3 Moderate | 1.50 | Consumes the helper from ISW-4 and can later power EV-1. |
| ISW-1 | Extract the new/edit candidate form markup shared by `InterviewsView.jsx` and `CandidatesView.jsx` into a component or form hook. | E3 Moderate | I4 High | 1.33 | Works best after SUX-1 so both modals share the same shell. |
| ISW-2 | Break up the 600+ line `InterviewsView.jsx` into focused pieces (`InterviewForm`, `InspectModal`, `useInterviewScheduling`) while keeping submission and selection logic cohesive. | E2 Hard | I5 Critical | 1.25 | Depends on ISW-1, ISW-3, ISW-5, and SUX-1 to avoid rework while splitting. |
| ISW-5 | Normalize resume upload/selection into a dedicated hook or service consumed by the scheduling flow. | E3 Moderate | I3 Moderate | 1.00 | Pair with ISW-2 to isolate storage concerns before further UI polish. |

## Shared UX Infrastructure (Avg Priority 1.415)
| Task ID | Description | Ease | Impact | Priority Score | Dependencies / Notes |
| --- | --- | --- | --- | --- | --- |
| SUX-1 | Create a reusable modal shell component for the repeated overlay/transition markup in `InterviewsView.jsx` and `CandidatesView.jsx`. | E4 Easy | I3 Moderate | 1.50 | Enables ISW-1 and ISW-2 to drop duplicated scaffolding. |
| SUX-2 | Centralize toast notifications in a provider or `useToast` hook instead of duplicating state/effects across `DashboardView.jsx`, `InterviewsView.jsx`, `CandidatesView.jsx`, and `CandidatePortal.jsx`. | E3 Moderate | I4 High | 1.33 | Can leverage SDH-1 once standard Supabase error objects flow through. |

## Shared Data Hooks & Services (Avg Priority 1.110)
| Task ID | Description | Ease | Impact | Priority Score | Dependencies / Notes |
| --- | --- | --- | --- | --- | --- |
| SDH-1 | Build a generic Supabase query hook (or data service) and refactor `useCandidates.js`, `useJobs.js`, `useQuestions.js`, `usePromptVersions.js`, and `useRubricVersions.js` to consume it. | E3 Moderate | I4 High | 1.33 | Lays groundwork for SDH-2, SDH-3, and SUX-2 error handling. |
| SDH-2 | Wrap the multi-fetch dashboard logic in `DashboardView.jsx` into a `useDashboardData` hook for cohesive loading, caching, and error handling. | E2 Hard | I4 High | 1.00 | Reuses the abstraction from SDH-1 for consistent querying. |
| SDH-3 | Introduce a `useCandidateInterviews` hook (or API service) so `CandidatePortal.jsx` and admin screens load interview/token data the same way. | E3 Moderate | I3 Moderate | 1.00 | Benefits from SDH-1 to avoid duplicating query scaffolding. |

## Evaluation Workflow (Avg Priority 1.000)
| Task ID | Description | Ease | Impact | Priority Score | Dependencies / Notes |
| --- | --- | --- | --- | --- | --- |
| EV-1 | Extract the tabbed evaluation detail renderer in `frontend/src/components/EvaluationsView.jsx` into composable pieces (`EvaluationTabs`, `useEvaluationFilters`) and reuse rubric helpers from ISW-3/ISW-4. | E3 Moderate | I3 Moderate | 1.00 | Builds on the shared rubric utilities and could plug into future reporting screens. |

## Video & Real-Time (Avg Priority 0.800)
| Task ID | Description | Ease | Impact | Priority Score | Dependencies / Notes |
| --- | --- | --- | --- | --- | --- |
| VR-1 | Break `frontend/video-client/src/App.jsx` into dedicated components/hooks (`usePipecatConnection`, media controls, logging) that `frontend/src/components/InterviewSession.jsx` can consume when video support is re-enabled. | E1 Very Hard | I4 High | 0.80 | Aligns with ISW-2 once the interview session reacquires live video features. |

## Ordered TODOs
- TODO 01-01 - Implement ISW-4: centralize the prompt/rubric label helper into a shared utility and update `InterviewsView.jsx` plus `InterviewSummary.jsx` to consume it.
- TODO 01-02 - Complete ISW-3: extract `RubricViewer` to its own component file and wire it into `InterviewsView.jsx` and `EvaluationsView.jsx`.
- TODO 01-03 - Execute ISW-1: turn the candidate add/edit form into a shared component or hook used by both `InterviewsView.jsx` and `CandidatesView.jsx` modals.
- TODO 01-04 - Deliver ISW-2: decompose `InterviewsView.jsx` into focused subcomponents and hooks while keeping scheduling behaviour intact.
- TODO 01-05 - Ship ISW-5: move resume upload and selection logic into a dedicated hook/service and replace the inline handlers.
- TODO 01-06 - Fulfill SUX-1: build the reusable modal shell and swap it into the scheduling and candidate screens.
- TODO 01-07 - Tackle SUX-2: add a toast provider/hook and migrate existing views to it.
- TODO 01-08 - Roll out SDH-1: create the generic Supabase query helper and refactor the existing resource hooks to use it.
- TODO 01-09 - Apply SDH-2: introduce `useDashboardData` inside `DashboardView.jsx` and remove in-component fetch orchestration.
- TODO 01-10 - Implement SDH-3: provide a shared `useCandidateInterviews` hook/service and update `CandidatePortal.jsx` and admin surfaces accordingly.
- TODO 01-11 - Complete EV-1: split `EvaluationsView.jsx` into reusable evaluation components/hooks that reuse the shared rubric helpers.
- TODO 01-12 - Address VR-1: modularize the Pipecat video client into hooks/components and reconnect it with `InterviewSession.jsx` when ready.

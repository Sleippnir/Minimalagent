# Manager Dashboard Requirements

This document outlines the proposed features and functionality for the manager dashboard in the Minimalagent platform, focusing on oversight, decision-making, and analytics for hiring managers.

## Core Manager Features

### Team Hiring Overview

- **My Jobs Dashboard**: Overview of all job postings they own/manage
- **Team Interview Calendar**: Schedule view of all upcoming interviews for their team
- **Hiring Pipeline**: Visual pipeline showing candidates at each stage (applied → screened → interviewed → offered)
- **Team Workload**: See which recruiters/HR staff are assigned to their jobs

### Interview Management & Oversight

- **Interview Scheduling**: Book interview slots, assign interviewers, send calendar invites
- **Live Interview Monitoring**: See which interviews are in progress, join remotely
- **Interview Notes & Feedback**: Review interviewer notes, add manager feedback
- **Decision Tools**: Approve/reject candidates, provide hiring recommendations

### Candidate Management

- **Candidate Profiles**: View detailed candidate info, resumes, interview history
- **Candidate Communication**: Send messages to candidates, schedule follow-ups
- **Offer Management**: Track offer status, approvals, and acceptance rates
- **Candidate Pool**: Saved candidates for future opportunities

### Analytics & Reporting

- **Hiring Metrics**: Time-to-hire, offer acceptance rates, source effectiveness
- **Team Performance**: Interviewer effectiveness, completion rates
- **Job Performance**: Which jobs are attracting good candidates, conversion rates
- **Diversity Analytics**: Hiring diversity metrics and goals tracking

### Workflow & Approvals

- **Requisition Approvals**: Approve job requisitions from their team
- **Budget Tracking**: Monitor hiring budget vs. actual spend
- **Hiring Freezes**: Ability to pause hiring for specific roles/departments
- **Stakeholder Notifications**: Alert relevant team members about hiring progress

### Communication & Collaboration

- **Internal Notes**: Private notes on candidates for their team
- **Feedback to HR**: Provide feedback on recruitment process quality
- **Interview Debriefs**: Schedule post-interview discussions with hiring teams
- **Stakeholder Updates**: Automated status updates to executives/other managers

### Administrative Tools

- **User Management**: Add/remove interviewers, update permissions
- **Template Management**: Create standardized job descriptions, interview guides
- **Integration Settings**: Connect with ATS, calendar systems, email
- **Audit Trail**: Track all hiring decisions and changes for compliance

## Prioritized Implementation Order

### Phase 1: Core Visibility (Weeks 1-2)

1. **My Jobs Dashboard** - Overview of managed job postings
2. **Team Interview Calendar** - Schedule visibility and basic monitoring
3. **Hiring Pipeline View** - Basic candidate stage tracking

### Phase 2: Active Management (Weeks 3-6)

1. **Interview Scheduling Tools** - Book slots, assign interviewers
2. **Interview Monitoring** - Live status, remote joining capability
3. **Decision Tools** - Approve/reject candidates with recommendations

### Phase 3: Communication & Collaboration (Weeks 7-10)

1. **Internal Notes System** - Team collaboration on candidates
2. **Feedback Mechanisms** - Manager feedback to HR/recruiters
3. **Stakeholder Communication** - Automated updates and notifications

### Phase 4: Analytics & Optimization (Weeks 11-14)

1. **Hiring Metrics Dashboard** - Key performance indicators
2. **Team Performance Analytics** - Interviewer effectiveness tracking
3. **Optimization Recommendations** - Data-driven hiring improvements

### Phase 5: Advanced Features (Weeks 15+)

1. **Budget & Requisition Management** - Financial oversight
2. **Advanced Integrations** - ATS, calendar, email systems
3. **Audit & Compliance Tools** - Full compliance tracking

## Technical Considerations

### Data Access Patterns

- Managers should only see candidates/jobs for their team/department
- Row Level Security (RLS) policies needed for data isolation
- Cached views for performance (similar to existing queue architecture)

### UI/UX Requirements

- Clean, executive-friendly interface (less technical than HR dashboard)
- Mobile-responsive for on-the-go approvals and reviews
- Dashboard-style layout with key metrics prominently displayed

### Integration Points

- Calendar systems (Google Calendar, Outlook)
- Email systems for notifications
- Existing HR dashboard for seamless workflow
- ATS systems for offer management

## Success Metrics

### User Adoption

- Manager login frequency and session duration
- Feature usage rates (scheduling, approvals, feedback)
- Time savings compared to existing processes

### Process Improvements

- Reduced time-to-hire
- Improved offer acceptance rates
- Better communication between managers and HR

### Data Quality

- Completion rates for required fields
- Accuracy of hiring decision tracking
- Quality of manager feedback and notes

## Open Questions for Development

### Scope Definition

- Should managers be able to create/edit job descriptions directly?
- What level of candidate data should managers see (full profiles vs. summaries)?
- How much control over interview processes (scheduling vs. full customization)?

### Integration Depth

- How tightly should this integrate with existing ATS systems?
- What calendar/email integrations are most valuable?
- Should there be API access for custom integrations?

### Security & Compliance

- What audit trails are required for hiring decisions?
- How to handle sensitive candidate data access?
- What approval workflows need to be configurable?

This roadmap provides a comprehensive foundation for the manager dashboard while allowing for iterative development based on user feedback and business needs.

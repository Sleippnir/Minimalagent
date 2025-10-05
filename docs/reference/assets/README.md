# HR Dashboard

The HR Dashboard provides a comprehensive interface for HR personnel and recruiters to manage the interview process.

## Features

### Dashboard Overview

- **Statistics Cards**: View total interviews, scheduled for today, in-progress, and completed interviews
- **Quick Actions**: Fast access to create interviews, view calendar, and manage candidates
- **Interview Management**: View, edit, and cancel interviews with filtering capabilities

### Role-Based Access

- Automatically detects HR/recruiter roles based on:
  - User metadata role field (`hr` or `recruiter`)
  - Email domain patterns (`hr@` or `recruiter@`)
- Non-HR users are redirected to the interview creation page

### Interview Table

- Displays recent interviews with candidate and job information
- Status badges with color coding
- Action buttons for viewing, editing, and cancelling interviews
- Filtering by status and date

## File Structure

```text
frontend/hr/
├── dashboard.html      # Main dashboard interface
└── hr-dashboard.js     # Dashboard functionality
```

## Authentication Flow

1. User logs in via `manager_login.html`
2. System checks user role
3. HR users are redirected to `hr/dashboard.html`
4. Dashboard initializes auth state and loads interview data
5. Access is validated on each page load

## Database Integration

The dashboard queries the following tables:

- `interviews` - Main interview data
- `applications` - Links interviews to candidates and jobs
- `candidates` - Candidate information
- `jobs` - Job position details

## Security

- Requires authentication
- Role-based access control
- Automatic logout on access denial
- Session validation on page load

## Future Enhancements

- Calendar view integration
- Advanced candidate management
- Interview analytics and reporting
- Bulk interview operations
- Email notifications for HR actions
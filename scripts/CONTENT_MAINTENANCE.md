# Content Consistency Maintenance Guide

This guide explains how to maintain tag consistency and job-question matching in the Minimalagent platform.

## 🎯 Overview

The platform uses an automated tagging system to ensure jobs and questions are properly matched. This prevents the issues we encountered where jobs and questions used different tag taxonomies.

## 🔧 Maintenance System Components

### 1. Automated Tagger (`automated_tagger.py`)
- **Purpose**: Generates consistent tags for jobs and questions
- **Features**:
  - Unified tag taxonomy across all content
  - Context-aware filtering (avoids false positives)
  - Scoring system for tag prioritization
  - Support for both technical and behavioral content

### 2. Content Manager (`content_manager.py`)
- **Purpose**: Validates and fixes content consistency
- **Features**:
  - Tag validation for existing content
  - Relationship optimization
  - Bulk fixing capabilities
  - Audit functionality

### 3. API Endpoints (`interview_api.py`)
- **Purpose**: Ensures new content is properly tagged
- **Endpoints**:
  - `POST /admin/content/validate-job-tags` - Validate new job tags
  - `POST /admin/content/validate-question-tags` - Validate new question tags
  - `POST /admin/content/fix-job/{job_id}` - Fix existing job tags
  - `POST /admin/content/fix-question/{question_id}` - Fix existing question tags
  - `GET /admin/content/audit` - Run consistency audit
  - `POST /admin/content/bulk-fix` - Fix all issues
  - `POST /admin/content/refresh-relationships/{job_id}` - Refresh job relationships

## 🚀 How to Add New Content

### Adding a New Job
```python
from content_manager import validate_new_job_tags

# Always validate tags before saving
tags = validate_new_job_tags(job_title, job_description)

# Save job with validated tags
job_data = {
    "title": job_title,
    "description": job_description,
    "required_tags": tags  # Use validated tags
}
```

### Adding a New Question
```python
from content_manager import validate_new_question_tags

# Always validate tags before saving
tags = validate_new_question_tags(question_text, category)

# Save question with validated tags
question_data = {
    "text": question_text,
    "category": category,
    "tags": tags  # Use validated tags
}
```

## 🔄 Regular Maintenance

### Option 1: Manual Maintenance Script
Run the maintenance script weekly:
```bash
python maintain_content.py
```

### Option 2: Scheduled Maintenance
Set up a cron job to run daily:
```bash
# Add to crontab (crontab -e)
0 2 * * * /path/to/venv/bin/python /path/to/minimalagent/scheduled_maintenance.py
```

### Option 3: API-Based Maintenance
Use the admin endpoints:
```bash
# Run audit
curl -X GET http://localhost:8000/admin/content/audit

# Fix all issues
curl -X POST http://localhost:8000/admin/content/bulk-fix
```

## 📊 Monitoring Content Health

### Quick Health Check
```python
from content_manager import ContentManager

manager = ContentManager()
audit = manager.audit_content_consistency()

print(f"Overall health: {audit['overall_health']}")
print(f"Job issues: {len(audit['job_issues'])}")
print(f"Question issues: {len(audit['question_issues'])}")
print(f"Relationship issues: {len(audit['relationship_issues'])}")
```

### Detailed Validation
```python
# Check specific job
validation = manager.validate_job_tags(job_id)
if not validation['valid']:
    print(f"Job needs fixing: {validation['missing_tags']}")

# Check relationships
rel_validation = manager.validate_relationships(job_id)
print(f"Average tag overlap: {rel_validation['average_overlap']}")
```

## 🛠️ Fixing Issues

### Fix Individual Items
```python
# Fix a specific job
result = manager.fix_job_tags(job_id)
if result['updated']:
    print(f"Fixed job tags: {result['old_tags']} → {result['new_tags']}")

# Fix a specific question
result = manager.fix_question_tags(question_id)

# Refresh relationships for a job
manager.refresh_job_relationships(job_id)
```

### Bulk Fixes
```python
# Fix all content issues
results = manager.bulk_fix_content()
print(f"Fixed {results['jobs_fixed']} jobs, {results['questions_fixed']} questions")
```

## 🎯 Best Practices

### 1. Always Use Validation Functions
- Never manually assign tags to new content
- Always use `validate_new_job_tags()` and `validate_new_question_tags()`

### 2. Regular Audits
- Run maintenance scripts at least weekly
- Monitor the "overall_health" status
- Address issues promptly

### 3. Monitor Tag Overlap
- Ensure job-question relationships have good tag overlap (≥2.0 average)
- Refresh relationships when job tags change

### 4. Content Quality
- Review automated tags for accuracy
- Add domain-specific keywords to the tagger if needed
- Maintain the unified tag taxonomy

## 🚨 Troubleshooting

### Common Issues

**Low Tag Overlap**: Questions don't match job requirements well
- **Solution**: Run `refresh_job_relationships()` for affected jobs

**Inconsistent Tags**: Jobs and questions use different tag names
- **Solution**: Run bulk fix or update the automated tagger's keyword mappings

**Missing Tags**: New content types aren't getting proper tags
- **Solution**: Add new keywords to the `unified_tags` dictionary in `automated_tagger.py`

### Emergency Fixes

If content becomes severely inconsistent:
```bash
# Complete database rebuild (use with caution)
python fix_database.py
```

## 📈 Future Improvements

- **Machine Learning**: Train ML model for better tag prediction
- **Feedback Loop**: Learn from manual tag corrections
- **Category Expansion**: Add more granular categories
- **Performance**: Optimize tag matching for large datasets

## 📞 Support

For issues with content consistency:
1. Run the audit script: `python maintain_content.py`
2. Check the logs in `content_maintenance.log`
3. Use the admin API endpoints for targeted fixes
4. Review this guide for common solutions
# Training Data for LLM Content Generation

This directory contains enriched datasets with semantic tags for generating interview questions and job descriptions using LLMs.

## Files

### Questions Data

- `questions_semantic_tags.csv` - 81 interview questions with semantic tags
- `semantic_tags_analysis.json` - Detailed analysis of question tagging process

### Jobs Data

- `jobs_final_semantic_tags.csv` - 10 job descriptions with semantic tags
- `jobs_semantic_tags_analysis.json` - Detailed analysis of job tagging process

## Data Structure

### Questions CSV Columns

- `question_id`: Unique identifier
- `text`: The interview question
- `ideal_answer`: Expected answer with evaluation criteria
- `category`: Question category (Behavioral, Technical, etc.)
- `created_at`: Timestamp
- `tags`: Array of semantic tags

### Jobs CSV Columns

- `job_id`: Unique identifier
- `title`: Job title
- `description`: Full job description with responsibilities and requirements
- `created_at`: Timestamp
- `required_tags`: Array of semantic tags

## Usage for LLM Generation

These datasets can be used to:

1. **Generate similar questions** - Use semantic tags to create questions in specific categories
2. **Generate job descriptions** - Use tags to create job postings for specific roles
3. **Expand content** - Use the analysis files to understand tagging patterns

## Semantic Tags

Tags capture:

- **Technical skills**: `javascript`, `python`, `react`, `docker`, etc.
- **Competencies**: `problem-solving`, `communication`, `leadership`
- **Experience levels**: `senior-level`, `mid-level`, `entry-level`
- **Domains**: `frontend-development`, `backend-development`, `data-science`
- **Methodologies**: `agile-methodology`, `ci-cd`, `test-automation`

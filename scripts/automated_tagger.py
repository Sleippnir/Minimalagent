#!/usr/bin/env python3
"""
Automated tagging system for consistent question and job tagging.
"""

import re
import json
from collections import defaultdict

class AutomatedTagger:
    """Automated tagging system for questions and jobs."""

    def __init__(self):
        # Unified tag taxonomy - standardized tags used by both questions and jobs
        self.unified_tags = {
            # Technical Skills - expanded with more comprehensive keywords
            'algorithms': ['algorithm', 'algorithms', 'data structures', 'complexity', 'optimization', 'sorting', 'searching', 'graph', 'tree', 'dynamic programming'],
            'api-development': ['api', 'rest', 'graphql', 'endpoint', 'integration', 'web service', 'microservice', 'restful', 'http'],
            'authentication-authorization': ['auth', 'authentication', 'authorization', 'security', 'oauth', 'jwt', 'login', 'access control', 'permissions'],
            'automation': ['automate', 'automation', 'scripting', 'workflow', 'ci/cd', 'pipeline', 'deployment automation'],
            'backend-development': ['backend', 'server', 'server-side', 'api development', 'server logic', 'business logic'],
            'cloud-infrastructure': ['cloud', 'aws', 'azure', 'gcp', 'infrastructure', 'cloud computing', 'iaas', 'paas'],
            'containerization': ['docker', 'kubernetes', 'container', 'orchestration', 'pod', 'cluster', 'helm'],
            'database-management': ['database', 'sql', 'nosql', 'query', 'data modeling', 'schema', 'indexing', 'mongodb', 'postgresql', 'mysql'],
            'deployment': ['deploy', 'deployment', 'release', 'ci/cd', 'pipeline', 'continuous integration', 'continuous deployment'],
            'devops': ['devops', 'infrastructure', 'automation', 'monitoring', 'site reliability', 'sre', 'configuration management'],
            'distributed-systems': ['distributed', 'scalability', 'concurrency', 'microservices', 'load balancing', 'sharding', 'consistency'],
            'frontend-development': ['frontend', 'client-side', 'ui', 'ux', 'javascript', 'react', 'vue', 'angular', 'typescript', 'html', 'css'],
            'infrastructure': ['infrastructure', 'servers', 'networking', 'system administration', 'monitoring', 'logging', 'alerting'],
            'machine-learning': ['machine learning', 'ml', 'ai', 'data science', 'neural network', 'tensorflow', 'pytorch', 'scikit-learn'],
            'mobile-development': ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin', 'mobile app'],
            'performance': ['performance', 'optimization', 'scalability', 'efficiency', 'benchmarking', 'profiling', 'bottleneck'],
            'problem-solving': ['problem solving', 'analytical', 'logic', 'debugging', 'troubleshooting', 'root cause'],
            'programming-languages': ['python', 'javascript', 'java', 'c++', 'go', 'rust', 'typescript', 'ruby', 'php', 'c#'],
            'quality-assurance': ['qa', 'testing', 'quality', 'automation testing', 'test case', 'regression', 'unit test', 'integration test'],
            'scalability': ['scalability', 'performance', 'load balancing', 'high availability', 'horizontal scaling', 'vertical scaling'],
            'security': ['security', 'encryption', 'vulnerability', 'penetration testing', 'owasp', 'ssl', 'firewall', 'authentication'],
            'software-engineering': ['software engineering', 'development', 'coding', 'programming', 'software development', 'engineering'],
            'system-architecture': ['architecture', 'design patterns', 'system design', 'software architecture', 'technical architecture'],
            'technical-architecture': ['architecture', 'design', 'system design', 'technical leadership', 'solution architecture'],
            'user-interface': ['ui', 'user interface', 'interface design', 'user experience', 'ux', 'usability', 'responsive design', 'frontend ui'],
            'web-development': ['web', 'html', 'css', 'browser', 'responsive', 'web application', 'single page application'],

            # Soft Skills & Behavioral - expanded
            'analytical-thinking': ['analytical', 'analysis', 'critical thinking', 'logic', 'reasoning', 'problem analysis'],
            'career-development': ['career', 'growth', 'development', 'learning', 'professional development', 'skill development'],
            'communication': ['communication', 'presentation', 'collaboration', 'stakeholder', 'verbal', 'written', 'meeting'],
            'conflict-resolution': ['conflict', 'resolution', 'negotiation', 'difficult situations', 'disagreement', 'mediation'],
            'creative-problem-solving': ['creative', 'innovation', 'problem solving', 'thinking outside box', 'creative solution'],
            'cultural-fit': ['culture', 'values', 'team dynamics', 'work environment', 'company culture', 'team fit'],
            'decision-making': ['decision', 'judgment', 'prioritization', 'trade-offs', 'decision process', 'choice'],
            'leadership': ['leadership', 'mentoring', 'team management', 'guidance', 'leading', 'coaching'],
            'project-management': ['project management', 'planning', 'organization', 'deadlines', 'milestone', 'timeline'],
            'team-management': ['team', 'collaboration', 'management', 'leadership', 'teamwork', 'group work'],
            'time-management': ['time management', 'prioritization', 'efficiency', 'deadlines', 'time constraint', 'scheduling'],
            'work-ethic': ['work ethic', 'reliability', 'commitment', 'responsibility', 'dedication', 'professionalism']
        }

        # Category-specific tag priorities
        self.category_priorities = {
            'Behavioral': ['communication', 'leadership', 'team-management', 'conflict-resolution', 'decision-making'],
            'Cultural Fit': ['cultural-fit', 'communication', 'team-management', 'work-ethic'],
            'General SE': ['software-engineering', 'algorithms', 'system-architecture', 'problem-solving'],
            'DevOps': ['devops', 'automation', 'deployment', 'cloud-infrastructure', 'infrastructure'],
            'Frontend': ['frontend-development', 'user-interface', 'web-development', 'javascript'],
            'Backend': ['backend-development', 'api-development', 'database-management', 'scalability'],
            'System Design': ['system-architecture', 'scalability', 'distributed-systems', 'performance'],
            'Problem Solving': ['problem-solving', 'analytical-thinking', 'algorithms', 'decision-making'],
            'Situational': ['decision-making', 'communication', 'leadership', 'conflict-resolution']
        }

        # Build reverse mapping for faster lookup
        self.keyword_to_tag = {}
        for tag, keywords in self.unified_tags.items():
            for keyword in keywords:
                if keyword not in self.keyword_to_tag:
                    self.keyword_to_tag[keyword] = []
                self.keyword_to_tag[keyword].append(tag)

    def generate_tags(self, text, category=None, max_tags=8):
        """Generate tags for given text content with improved scoring and coverage."""
        if not text:
            return []

        # Normalize text
        text_lower = text.lower()
        tag_scores = {}

        # Score each tag based on keyword matches with different weights
        for tag, keywords in self.unified_tags.items():
            score = 0
            matched_keywords = []

            for keyword in keywords:
                keyword_lower = keyword.lower()
                # Exact word match gets highest score (3 points)
                if re.search(r'\b' + re.escape(keyword_lower) + r'\b', text_lower):
                    score += 3
                    matched_keywords.append(keyword)
                # Partial substring match gets medium score (1 point) - but only for longer keywords to avoid false positives
                elif len(keyword_lower) > 2 and keyword_lower in text_lower:
                    score += 1
                    matched_keywords.append(keyword)

            if score > 0:
                tag_scores[tag] = {'score': score, 'keywords': matched_keywords}

        # Sort tags by score (highest first)
        sorted_tags = sorted(tag_scores.items(), key=lambda x: x[1]['score'], reverse=True)

        # Apply category-specific prioritization if category provided
        if category and category in self.category_priorities:
            priority_tags = set(self.category_priorities[category])
            prioritized = []
            others = []

            for tag, data in sorted_tags:
                if tag in priority_tags:
                    prioritized.append(tag)
                else:
                    others.append(tag)

            sorted_tags = [(tag, tag_scores[tag]) for tag in (prioritized + others)]

        # Extract just the tag names
        tag_list = [tag for tag, data in sorted_tags]

        # Apply context-aware filtering to avoid false positives
        filtered_tags = []
        content_lower = text.lower()

        # Context indicators for different domains
        backend_indicators = ['database', 'server', 'api', 'backend', 'schema', 'query', 'sql', 'nosql', 'microservice']
        frontend_indicators = ['ui', 'user interface', 'frontend', 'client', 'browser', 'responsive', 'css', 'html']
        devops_indicators = ['infrastructure', 'deployment', 'ci/cd', 'pipeline', 'cloud', 'docker', 'kubernetes']

        is_backend_context = any(indicator in content_lower for indicator in backend_indicators)
        is_frontend_context = any(indicator in content_lower for indicator in frontend_indicators)
        is_devops_context = any(indicator in content_lower for indicator in devops_indicators)

        for tag in tag_list:
            # Skip UI/frontend tags in backend/database contexts
            if tag == 'user-interface' and is_backend_context and not is_frontend_context:
                continue
            # Skip backend tags in pure frontend contexts (allow some overlap)
            if tag in ['database-management', 'backend-development'] and is_frontend_context and not is_backend_context:
                continue
            # Skip infrastructure tags in pure application development contexts
            if tag == 'infrastructure' and not (is_devops_context or is_backend_context):
                continue

            filtered_tags.append(tag)

        # If filtering removed too many tags, add back essential ones
        min_tags = 3
        if len(filtered_tags) < min_tags and len(tag_list) >= min_tags:
            essential_tags = [tag for tag in tag_list if tag not in filtered_tags]
            filtered_tags.extend(essential_tags[:min_tags - len(filtered_tags)])

        tag_list = filtered_tags

        # Ensure minimum coverage with fallback tags
        if len(tag_list) < min_tags:
            # Add common fallback tags based on content analysis
            fallback_tags = []

            # Technical content indicators
            if any(word in text_lower for word in ['code', 'programming', 'development', 'software', 'system']):
                fallback_tags.append('software-engineering')

            # Problem-solving indicators
            if any(word in text_lower for word in ['design', 'implement', 'solve', 'create', 'build', 'how would', 'approach']):
                fallback_tags.append('problem-solving')

            # Add fallbacks that aren't already in the list
            for fallback in fallback_tags:
                if fallback not in tag_list:
                    tag_list.append(fallback)
                    if len(tag_list) >= min_tags:
                        break

        # Limit to max_tags
        return tag_list[:max_tags]

    def generate_question_tags(self, question_text, category):
        """Generate tags specifically for questions."""
        return self.generate_tags(question_text, category, max_tags=6)

    def generate_job_tags(self, title, description):
        """Generate tags specifically for jobs."""
        # Combine title and description for better tag extraction
        combined_text = f"{title} {description}"

        # Determine likely category from title
        job_category = self._infer_job_category(title)

        return self.generate_tags(combined_text, job_category, max_tags=8)

    def _infer_job_category(self, title):
        """Infer job category from title."""
        title_lower = title.lower()

        if any(word in title_lower for word in ['frontend', 'ui', 'ux', 'designer']):
            return 'Frontend'
        elif any(word in title_lower for word in ['backend', 'server', 'api']):
            return 'Backend'
        elif any(word in title_lower for word in ['devops', 'infrastructure', 'platform', 'site reliability']):
            return 'DevOps'
        elif any(word in title_lower for word in ['data', 'machine learning', 'ml', 'ai']):
            return 'Machine Learning'
        elif any(word in title_lower for word in ['manager', 'lead', 'principal', 'architect']):
            return 'System Design'
        elif any(word in title_lower for word in ['qa', 'quality', 'test']):
            return 'Quality Assurance'
        else:
            return 'General SE'

    def get_available_tags(self):
        """Get all available unified tags."""
        return list(self.unified_tags.keys())

    def validate_tag_consistency(self, tags):
        """Validate that tags are from the unified taxonomy."""
        available_tags = set(self.unified_tags.keys())
        return [tag for tag in tags if tag in available_tags]

def test_automated_tagger():
    """Test the automated tagger with sample content."""

    tagger = AutomatedTagger()

    # Test questions
    test_questions = [
        ("Explain the concept of microservices and their benefits", "System Design"),
        ("Describe a time when you resolved a conflict with a colleague", "Behavioral"),
        ("How would you implement authentication in a React application?", "Frontend"),
        ("Design a scalable database schema for a social media platform", "System Design")
    ]

    print("🧪 Testing Automated Tagger:")
    print("=" * 50)

    for question, category in test_questions:
        tags = tagger.generate_question_tags(question, category)
        print(f"Question: {question[:50]}...")
        print(f"Category: {category}")
        print(f"Tags: {tags}")
        print()

    # Test jobs
    test_jobs = [
        ("Senior Frontend Engineer", "Build responsive web applications using React and TypeScript"),
        ("DevOps Engineer", "Manage CI/CD pipelines and cloud infrastructure on AWS"),
        ("Senior Backend Engineer", "Design and implement scalable APIs and database solutions")
    ]

    print("💼 Testing Job Tagging:")
    print("=" * 50)

    for title, description in test_jobs:
        tags = tagger.generate_job_tags(title, description)
        print(f"Job: {title}")
        print(f"Description: {description[:50]}...")
        print(f"Tags: {tags}")
        print()

if __name__ == "__main__":
    test_automated_tagger()
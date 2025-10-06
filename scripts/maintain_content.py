#!/usr/bin/env python3
"""
Content Maintenance Script
Run this script regularly to ensure job-question tag consistency.
"""

import sys
import logging
from content_manager import ContentManager

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def main():
    """Main maintenance function."""
    logger.info("Starting content maintenance...")

    manager = ContentManager()

    # Run comprehensive audit
    logger.info("Running content consistency audit...")
    audit_results = manager.audit_content_consistency()

    print("\n📊 Content Audit Results:")
    print(f"   Jobs: {audit_results['total_jobs']}")
    print(f"   Questions: {audit_results['total_questions']}")
    print(f"   Job issues: {len(audit_results['job_issues'])}")
    print(f"   Question issues: {len(audit_results['question_issues'])}")
    print(f"   Relationship issues: {len(audit_results['relationship_issues'])}")
    print(f"   Overall health: {audit_results['overall_health']}")

    # Fix issues if any exist
    total_issues = (
        len(audit_results["job_issues"])
        + len(audit_results["question_issues"])
        + len(audit_results["relationship_issues"])
    )

    if total_issues > 0:
        logger.info(f"Found {total_issues} issues. Starting bulk fix...")
        fix_results = manager.bulk_fix_content()

        print("\n✅ Fix Results:")
        print(f"   Jobs fixed: {fix_results['jobs_fixed']}")
        print(f"   Questions fixed: {fix_results['questions_fixed']}")
        print(f"   Relationships refreshed: {fix_results['relationships_fixed']}")

        # Re-audit to verify
        logger.info("Re-auditing to verify fixes...")
        final_audit = manager.audit_content_consistency()
        print(f"\n🎯 Final Health: {final_audit['overall_health']}")

    else:
        print("\n✅ All content is consistent! No fixes needed.")

    logger.info("Content maintenance complete!")


if __name__ == "__main__":
    main()

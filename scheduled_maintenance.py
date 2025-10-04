#!/usr/bin/env python3
"""
Scheduled Content Maintenance
This script can be run as a cron job to maintain content consistency.
Example cron job (run daily at 2 AM):
0 2 * * * /path/to/venv/bin/python /path/to/minimalagent/scheduled_maintenance.py
"""
import sys
import os
import logging
from datetime import datetime

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from content_manager import ContentManager

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('content_maintenance.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def main():
    """Run scheduled content maintenance."""
    logger.info("Starting scheduled content maintenance...")

    try:
        manager = ContentManager()

        # Run audit
        audit = manager.audit_content_consistency()
        logger.info(f"Audit results: {audit['overall_health']}")

        # Fix issues if found
        total_issues = (len(audit['job_issues']) +
                       len(audit['question_issues']) +
                       len(audit['relationship_issues']))

        if total_issues > 0:
            logger.info(f"Found {total_issues} issues, running bulk fix...")
            fix_results = manager.bulk_fix_content()
            logger.info(f"Fixed: {fix_results['jobs_fixed']} jobs, "
                       f"{fix_results['questions_fixed']} questions, "
                       f"{fix_results['relationships_fixed']} relationships")

            # Log summary
            print(f"✅ Maintenance complete: {total_issues} issues fixed")
        else:
            logger.info("All content is consistent")
            print("✅ All content is consistent")

    except Exception as e:
        logger.error(f"Maintenance failed: {e}")
        print(f"❌ Maintenance failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
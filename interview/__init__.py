# Interview Container
# Main interview package with integrated bots, evaluator, and context services

from .config import InterviewConfig
from .bots.bot import InterviewBot
from .evaluator_service import InterviewEvaluator
from .context_service_integration import ContextService

__version__ = "1.0.0"
__all__ = [
    'InterviewConfig',
    'InterviewBot', 
    'InterviewEvaluator',
    'ContextService'
]

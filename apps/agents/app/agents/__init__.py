# app/agents/__init__.py
from .general_agent import general_agent
from .lesson_planer_agent import lesson_planner_agent
from .scheduling_agent import scheduling_agent
from .visual_support_agent import visual_support_agent
from .Multimodal_agent import multimodal_agent
from .analytics_agent import analytics_agent
from .rag_agent import rag_agent

__all__ = [
    "general_agent",
    "lesson_planner_agent",
    "scheduling_agent",
    "visual_support_agent",
    "multimodal_agent",
    "analytics_agent",
    "rag_agent"
]
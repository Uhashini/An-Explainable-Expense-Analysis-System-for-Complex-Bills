"""
Eat Healthy Mode — Services and Analysis
"""

# Export nutrition / health analysis services
try:
    from app.services.analytics_service import *
except ImportError:
    pass

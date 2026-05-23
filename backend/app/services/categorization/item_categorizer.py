"""Phase 3: Item Categorization Service"""

from typing import List, Dict, Optional
from app.core.constants import ItemCategory, CATEGORY_KEYWORDS
from app.core.exceptions import CategorizationException
from app.utils.logger import logger


class ItemCategorizer:
    """Service for intelligent item categorization."""

    @staticmethod
    def categorize_item(item_name: str, unit_price: Optional[float] = None) -> str:
        """Categorize a single item by name and optional price hints.
        
        Args:
            item_name: Name of the item
            unit_price: Optional unit price for heuristic-based categorization
            
        Returns:
            Category name
        """
        try:
            item_lower = item_name.lower()
            
            # Keyword matching against predefined categories
            for category, keywords in CATEGORY_KEYWORDS.items():
                for keyword in keywords:
                    if keyword.lower() in item_lower:
                        logger.debug(f"Categorized '{item_name}' as {category.value}")
                        return category.value
            
            # Default category
            logger.debug(f"Categorized '{item_name}' as 'other' (no match found)")
            return ItemCategory.OTHER.value
            
        except Exception as e:
            logger.error(f"Item categorization failed for '{item_name}': {e}")
            return ItemCategory.OTHER.value

    @staticmethod
    def categorize_batch(items: List[Dict]) -> List[Dict]:
        """Categorize multiple items in batch.
        
        Args:
            items: List of item dictionaries with 'name' and optional 'unit_price'
            
        Returns:
            Same items with 'category' field added/updated
        """
        try:
            categorized_items = []
            
            for item in items:
                item_name = item.get("name", "")
                unit_price = item.get("unit_price")
                
                category = ItemCategorizer.categorize_item(item_name, unit_price)
                
                # Update item with category
                item_copy = item.copy()
                item_copy["category"] = category
                categorized_items.append(item_copy)
            
            logger.info(f"Batch categorized {len(categorized_items)} items")
            return categorized_items
            
        except Exception as e:
            logger.error(f"Batch categorization failed: {e}")
            raise CategorizationException(f"Batch categorization error: {e}")

    @staticmethod
    def get_category_distribution(items: List[Dict]) -> Dict[str, float]:
        """Get percentage distribution of items by category.
        
        Args:
            items: List of categorized items (must have 'category' field)
            
        Returns:
            Dict mapping category to percentage (0-100)
        """
        try:
            if not items:
                return {}
            
            category_counts = {}
            for item in items:
                category = item.get("category", ItemCategory.OTHER.value)
                category_counts[category] = category_counts.get(category, 0) + 1
            
            total = len(items)
            distribution = {
                cat: (count / total) * 100 
                for cat, count in category_counts.items()
            }
            
            logger.debug(f"Category distribution: {distribution}")
            return distribution
            
        except Exception as e:
            logger.error(f"Distribution calculation failed: {e}")
            raise CategorizationException(f"Distribution calculation error: {e}")

    @staticmethod
    def get_category_breakdown(items: List[Dict]) -> Dict[str, float]:
        """Get monetary breakdown by category.
        
        Args:
            items: List of categorized items with 'total_price'
            
        Returns:
            Dict mapping category to total spent
        """
        try:
            category_spending = {}
            
            for item in items:
                category = item.get("category", ItemCategory.OTHER.value)
                total_price = float(item.get("total_price", 0))
                
                category_spending[category] = category_spending.get(category, 0) + total_price
            
            logger.debug(f"Category spending breakdown: {category_spending}")
            return category_spending
            
        except Exception as e:
            logger.error(f"Spending breakdown failed: {e}")
            raise CategorizationException(f"Spending breakdown error: {e}")

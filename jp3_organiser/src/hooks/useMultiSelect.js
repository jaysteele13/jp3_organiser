/**
 * useMultiSelect Hook
 * 
 * Manages multiselect state for lists with support for:
 * - Individual item toggle (click)
 * - Select all / deselect all
 * - Range selection (shift+click)
 * - Clear selection
 * 
 * @param {Array} items - Array of items with unique `id` property
 * @returns {Object} Selection state and handlers
 */

import { useState, useCallback, useMemo } from 'react';

export function useMultiSelect(items = []) {
  // Set of selected item IDs
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Track last selected index for shift+click range selection
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

  // Toggle a single item's selection
  const toggleItem = useCallback((id, index, isShiftKey = false) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      
      // Handle shift+click range selection
      if (isShiftKey && lastSelectedIndex !== null && index !== undefined) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        // Select all items in range
        for (let i = start; i <= end; i++) {
          if (items[i]?.id !== undefined) {
            next.add(items[i].id);
          }
        }
      } else {
        // Single toggle
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      
      return next;
    });
    
    // Update last selected index for shift+click
    if (index !== undefined) {
      setLastSelectedIndex(index);
    }
  }, [items, lastSelectedIndex]);

  // Select all items
  const selectAll = useCallback(() => {
    const allIds = new Set(items.map((item) => item.id));
    setSelectedIds(allIds);
    setLastSelectedIndex(null);
  }, [items]);

  // Deselect all items
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedIndex(null);
  }, []);

  // Check if an item is selected
  const isSelected = useCallback((id) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Get array of selected items (full objects)
  const selectedItems = useMemo(() => {
    return items.filter((item) => selectedIds.has(item.id));
  }, [items, selectedIds]);

  // Selection counts
  const selectedCount = selectedIds.size;
  const totalCount = items.length;
  const allSelected = totalCount > 0 && selectedCount === totalCount;
  const someSelected = selectedCount > 0 && selectedCount < totalCount;
  const hasSelection = selectedCount > 0;

  return {
    // State
    selectedIds,
    selectedItems,
    selectedCount,
    totalCount,
    allSelected,
    someSelected,
    hasSelection,
    
    // Actions
    toggleItem,
    selectAll,
    deselectAll,
    isSelected,
  };
}

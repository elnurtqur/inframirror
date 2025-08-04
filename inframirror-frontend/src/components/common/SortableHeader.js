import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const SortableHeader = ({ field, children, sortField, sortDirection, onSort }) => (
  <th 
    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
    onClick={() => onSort(field)}
  >
    <div className="flex items-center space-x-1">
      <span>{children}</span>
      {sortField === field && (
        sortDirection === 'asc' ? 
          <ChevronUp className="w-4 h-4" /> : 
          <ChevronDown className="w-4 h-4" />
      )}
    </div>
  </th>
);

export default SortableHeader;
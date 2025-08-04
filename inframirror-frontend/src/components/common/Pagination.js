import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ 
  currentPage, 
  itemsPerPage, 
  totalCount, 
  onPageChange, 
  onItemsPerPageChange 
}) => {
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalCount);

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-t">
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-700">
          Showing {startItem}-{endItem} of {totalCount} results
        </span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(e.target.value)}
          className="text-sm border border-gray-300 rounded px-2 py-1"
        >
          <option value="10">10 per page</option>
          <option value="25">25 per page</option>
          <option value="50">50 per page</option>
          <option value="100">100 per page</option>
        </select>
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        
        {[...Array(Math.min(5, totalPages))].map((_, index) => {
          let pageNum;
          if (totalPages <= 5) {
            pageNum = index + 1;
          } else if (currentPage <= 3) {
            pageNum = index + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + index;
          } else {
            pageNum = currentPage - 2 + index;
          }
          
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`px-3 py-1 text-sm border rounded ${
                currentPage === pageNum
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 hover:bg-gray-100'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
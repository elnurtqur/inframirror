import React from 'react';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  HardDrive, 
  Eye, 
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import LoadingButton from '../common/LoadingButton';
import SortableHeader from '../common/SortableHeader';

// VMID Badge komponenti
const VMIDCard = ({ vmid, size = 'xs' }) => {
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm', 
    md: 'px-4 py-2 text-base'
  };

  if (!vmid || vmid === 'N/A') {
    return (
      <span className={`inline-flex items-center ${sizeClasses[size]} bg-gray-100 text-gray-400 rounded-lg border border-gray-200 italic`}>
        No ID
      </span>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <div className={`inline-flex items-center ${sizeClasses[size]} bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-lg border border-blue-200 font-mono hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 shadow-sm cursor-default`}>
        <svg className="w-3 h-3 mr-1.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        <span className="select-all" title={`VM ID: ${vmid}`}>{vmid}</span>
        <button 
          onClick={() => navigator.clipboard?.writeText(vmid)}
          className="ml-1.5 p-0.5 hover:bg-blue-200 rounded transition-colors"
          title="Copy VM ID"
        >
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const MissingVMsTab = ({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  itemsPerPage,
  handleItemsPerPageChange,
  loading,
  loadMissingVMs,
  selectedVMIds,
  selectAll,
  handleSelectAll,
  handleVMSelection,
  setShowPostingModal,
  data,
  sortField,
  sortDirection,
  handleSort,
  showVMDetails,
  currentPage,
  handlePageChange,
  // ✅ YENİ - əlavə edilən prop-lar
  setSelectedVMIds,
  setSelectAll
}) => {
  return (
    <div className="space-y-6">
      {/* Enhanced Controls Panel */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search VMs by name or IP..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending_creation">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3">
            <LoadingButton
              loading={loading.missingVMs}
              onClick={loadMissingVMs}
              variant="primary"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </LoadingButton>

            {selectedVMIds.size > 0 && (
              <LoadingButton
                loading={loading.selectedJiraPost}
                onClick={() => setShowPostingModal(true)}
                variant="success"
              >
                <HardDrive className="w-4 h-4" />
                Post Selected ({selectedVMIds.size})
              </LoadingButton>
            )}
          </div>
        </div>

        {/* Enhanced Selection Info */}
        {data.missingVMs.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-900">
                    Select All ({data.missingVMs.filter(vm => vm.status === 'pending_creation').length} available)
                  </label>
                </div>
                
                {selectedVMIds.size > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">
                      {selectedVMIds.size} VM{selectedVMIds.size !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => {
                        setSelectedVMIds(new Set());
                        setSelectAll(false);
                      }}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Clear Selection
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>{data.missingVMs.filter(vm => vm.status === 'pending_creation').length} ready for posting</span>
                <span>{data.missingVMs.filter(vm => vm.status === 'failed').length} failed</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Missing VMs Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-orange-700">Missing VMs ({data.totalMissingCount})</h3>
              <p className="text-sm text-gray-600 mt-1">
                VMs found in vCenter but missing from Jira Asset Management
              </p>
            </div>
            
            {selectedVMIds.size > 0 && (
              <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-800">
                  <strong>{selectedVMIds.size}</strong> VM{selectedVMIds.size !== 1 ? 's' : ''} ready for posting
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <SortableHeader field="vm_name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  VM Name
                </SortableHeader>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <span>VM ID</span>
                  </div>
                </th>
                <SortableHeader field="vm_summary.ip" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  IP Address
                </SortableHeader>
                <SortableHeader field="vm_summary.cpu" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  CPU
                </SortableHeader>
                <SortableHeader field="vm_summary.memory" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Memory (GB)
                </SortableHeader>
                <SortableHeader field="vm_summary.disk" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Disk (GB)
                </SortableHeader>
                <SortableHeader field="vm_summary.site" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Site
                </SortableHeader>
                <SortableHeader field="vm_summary.environment" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Environment
                </SortableHeader>
                <SortableHeader field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Status
                </SortableHeader>
                <SortableHeader field="created_date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Created
                </SortableHeader>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.missingVMs.map((vm, index) => {
                const isSelectable = vm.status === 'pending_creation';
                const isSelected = selectedVMIds.has(vm.id);
                
                return (
                  <tr 
                    key={vm.id || index} 
                    className={`hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50 border-blue-200' : ''
                    } ${!isSelectable ? 'opacity-60' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isSelectable}
                        onChange={(e) => handleVMSelection(vm.id, e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        {vm.vm_name}
                        {isSelected && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Selected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <VMIDCard
                        vmid={vm.vmid || vm.vm_summary?.vmid || vm.debug_info?.vcenter_vmid}
                        size="xs"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vm.vm_summary?.ip || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vm.vm_summary?.cpu || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vm.vm_summary?.memory || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vm.vm_summary?.disk || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vm.vm_summary?.site || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vm.vm_summary?.environment || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        vm.status === 'pending_creation' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : vm.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {vm.status?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vm.created_date ? new Date(vm.created_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => showVMDetails(vm, 'missing')}
                        className="text-blue-600 hover:text-blue-800"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {loading.missingVMs ? (
            <div className="text-center py-12 text-gray-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Loading missing VMs...</p>
            </div>
          ) : data.totalMissingCount === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No missing VMs found</p>
              <p className="text-sm">All vCenter VMs are properly registered in Jira Asset Management</p>
            </div>
          ) : null}
        </div>

        {/* Enhanced Pagination */}
        {data.missingVMs.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 bg-white border-t">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Showing {Math.min((currentPage - 1) * itemsPerPage + 1, data.totalMissingCount)}-{Math.min(currentPage * itemsPerPage, data.totalMissingCount)} of {data.totalMissingCount} results
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {/* Page numbers */}
              {(() => {
                const totalPages = Math.ceil(data.totalMissingCount / itemsPerPage);
                const pages = [];
                const maxPages = 5;
                
                let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
                let endPage = Math.min(totalPages, startPage + maxPages - 1);
                
                if (endPage - startPage + 1 < maxPages) {
                  startPage = Math.max(1, endPage - maxPages + 1);
                }
                
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => handlePageChange(i)}
                      className={`px-3 py-1 text-sm border rounded ${
                        currentPage === i
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }
                
                return pages;
              })()}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= Math.ceil(data.totalMissingCount / itemsPerPage)}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissingVMsTab;

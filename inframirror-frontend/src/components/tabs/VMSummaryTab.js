import React from 'react';
import { Search, Filter, RefreshCw, Eye } from 'lucide-react';
import LoadingButton from '../common/LoadingButton';
import SortableHeader from '../common/SortableHeader';
import Pagination from '../common/Pagination';

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

const VMSummaryTab = ({
  vmDataSource,
  setVmDataSource,
  searchTerm,
  setSearchTerm,
  powerStateFilter,
  setPowerStateFilter,
  loading,
  loadVMs,
  data,
  currentPage,
  itemsPerPage,
  sortField,
  sortDirection,
  handleSort,
  handlePageChange,
  handleItemsPerPageChange,
  showVMDetails,
  getCurrentVMs,
  getTotalCount
}) => {
  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Data Source Selector */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Data Source:</label>
            <div className="flex space-x-2">
              <button
                onClick={() => setVmDataSource('vcenter')}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  vmDataSource === 'vcenter'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                vCenter VMs
              </button>
              <button
                onClick={() => setVmDataSource('jira')}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  vmDataSource === 'jira'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Jira VMs
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search VMs by name, IP, or hostname..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Power State Filter (only for vCenter) */}
          {vmDataSource === 'vcenter' && (
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={powerStateFilter}
                onChange={(e) => setPowerStateFilter(e.target.value)}
              >
                <option value="all">All Power States</option>
                <option value="poweredOn">Powered On</option>
                <option value="poweredOff">Powered Off</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          )}

          {/* Refresh Button */}
          <LoadingButton
            loading={loading.vms}
            onClick={loadVMs}
            variant="primary"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </LoadingButton>
        </div>
      </div>

      {/* VM Table */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h3 className={`text-lg font-semibold ${vmDataSource === 'vcenter' ? 'text-blue-700' : 'text-green-700'}`}>
            {vmDataSource === 'vcenter' ? 'vCenter' : 'Jira Asset'} VMs ({getCurrentVMs().length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
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
                <SortableHeader field="ip_address" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  IP Address
                </SortableHeader>
                {vmDataSource === 'vcenter' && (
                  <SortableHeader field="power_state" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    Power State
                  </SortableHeader>
                )}
                {vmDataSource === 'jira' && (
                  <SortableHeader field="jira_object_key" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    Jira Key
                  </SortableHeader>
                )}
                <SortableHeader field="cpu_count" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  CPU
                </SortableHeader>
                <SortableHeader field="memory_gb" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                  Memory
                </SortableHeader>
                {vmDataSource === 'vcenter' && (
                  <SortableHeader field="guest_os" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    Guest OS
                  </SortableHeader>
                )}
                {vmDataSource === 'jira' && (
                  <SortableHeader field="operating_system" sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
                    OS
                  </SortableHeader>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {getCurrentVMs().map((vm, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {vm.name || vm.vm_name}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <VMIDCard vmid={vm.vmid || vm.vm_summary?.vmid} size="xs" />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {vm.ip_address || 'N/A'}
                  </td>
                  {vmDataSource === 'vcenter' && (
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        vm.power_state === 'poweredOn' 
                          ? 'bg-green-100 text-green-800'
                          : vm.power_state === 'poweredOff'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {vm.power_state || 'Unknown'}
                      </span>
                    </td>
                  )}
                  {vmDataSource === 'jira' && (
                    <td className="px-6 py-4 text-sm text-blue-600">
                      {vm.jira_object_key}
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {vm.cpu_count || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {vm.memory_gb || 'N/A'} GB
                  </td>
                  {vmDataSource === 'vcenter' && (
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {vm.guest_os || 'N/A'}
                    </td>
                  )}
                  {vmDataSource === 'jira' && (
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {vm.operating_system || 'N/A'}
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <button
                      onClick={() => showVMDetails(vm, vmDataSource)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {getCurrentVMs().length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {loading.vms ? 'Loading VMs...' : `No ${vmDataSource === 'vcenter' ? 'vCenter' : 'Jira'} VMs found`}
            </div>
          )}
        </div>

        {/* Pagination */}
        {getTotalCount() > 0 && (
          <Pagination
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            totalCount={getTotalCount()}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>
    </div>
  );
};

export default VMSummaryTab;
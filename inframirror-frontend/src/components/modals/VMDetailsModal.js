import React from 'react';

// VMID Badge komponenti
const VMIDBadge = ({ vmid, size = 'md' }) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  if (!vmid || vmid === 'N/A') {
    return (
      <span className={`inline-flex items-center ${sizeClasses[size]} bg-gray-100 text-gray-400 rounded-lg border border-gray-200 italic`}>
        No VM ID
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${sizeClasses[size]} bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 rounded-lg border border-indigo-200 font-mono hover:from-indigo-100 hover:to-blue-100 transition-all duration-200 shadow-sm`}>
      <svg className="w-4 h-4 mr-1.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
      <span className="select-all">{vmid}</span>
      <button 
        onClick={() => navigator.clipboard?.writeText(vmid)}
        className="ml-2 p-1 hover:bg-indigo-200 rounded transition-colors"
        title="Copy VM ID"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>
    </span>
  );
};

const VMDetailsModal = ({ selectedVM, showVMModal, setShowVMModal }) => {
  if (!showVMModal || !selectedVM) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedVM.source === 'vcenter' ? 'vCenter' : selectedVM.source === 'jira' ? 'Jira' : 'Missing'} VM Details
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedVM.name || selectedVM.vm_name || 'Unknown VM'}
              </p>
            </div>
            <button
              onClick={() => setShowVMModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Basic Information
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <strong className="text-gray-600">Name:</strong> 
                  <span className="text-gray-900 font-medium">{selectedVM.name || selectedVM.vm_name || 'N/A'}</span>
                </div>
                
                {/* VMID - Xüsusi dizayn */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <strong className="text-gray-600">VM ID:</strong> 
                  <VMIDBadge 
                    vmid={
                      selectedVM.vmid || 
                      selectedVM.vm_summary?.vmid || 
                      selectedVM.debug_info?.vmid || 
                      (selectedVM.source === 'missing' ? selectedVM.vm_summary?.vmid : selectedVM.vmid)
                    } 
                    size="sm" 
                  />
                </div>

                {selectedVM.source === 'vcenter' && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <strong className="text-gray-600">UUID:</strong> 
                      <span className="font-mono text-xs text-gray-500 break-all max-w-[200px]">
                        {selectedVM.uuid || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <strong className="text-gray-600">MobID:</strong> 
                      <span className="font-mono text-xs text-gray-500">{selectedVM.mobid || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <strong className="text-gray-600">Power State:</strong> 
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        selectedVM.power_state === 'poweredOn' 
                          ? 'bg-green-100 text-green-800'
                          : selectedVM.power_state === 'poweredOff'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedVM.power_state || 'Unknown'}
                      </span>
                    </div>
                  </>
                )}

                {selectedVM.source === 'jira' && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <strong className="text-gray-600">Jira Key:</strong> 
                      <span className="text-blue-600 font-medium">{selectedVM.jira_object_key || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <strong className="text-gray-600">Jira ID:</strong> 
                      <span className="font-mono text-xs text-gray-500">{selectedVM.jira_object_id || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <strong className="text-gray-600">Site:</strong> 
                      <span className="text-gray-700">{selectedVM.site || 'N/A'}</span>
                    </div>
                  </>
                )}

                {selectedVM.source === 'missing' && (
                  <>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <strong className="text-gray-600">Status:</strong> 
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        selectedVM.status === 'pending_creation' 
                          ? 'bg-yellow-100 text-yellow-800'
                          : selectedVM.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedVM.status?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <strong className="text-gray-600">vCenter UUID:</strong> 
                      <span className="font-mono text-xs text-gray-500 break-all max-w-[200px]">
                        {selectedVM.debug_info?.vcenter_uuid || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <strong className="text-gray-600">vCenter MobID:</strong> 
                      <span className="font-mono text-xs text-gray-500">
                        {selectedVM.debug_info?.vcenter_mobid || 'N/A'}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <strong className="text-gray-600">IP Address:</strong> 
                  <span className="font-mono text-sm text-gray-700">
                    {selectedVM.ip_address || selectedVM.vm_summary?.ip || 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Hardware Specifications
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <strong className="text-gray-600">CPU:</strong> 
                  <span className="text-gray-900 font-medium">
                    {selectedVM.cpu_count || selectedVM.vm_summary?.cpu || 'N/A'}
                    {selectedVM.cpu_count && ' cores'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <strong className="text-gray-600">Memory:</strong> 
                  <span className="text-gray-900 font-medium">
                    {selectedVM.memory_gb || selectedVM.vm_summary?.memory || 'N/A'}
                    {(selectedVM.memory_gb || selectedVM.vm_summary?.memory) && ' GB'}
                  </span>
                </div>
                {(selectedVM.source === 'jira' || selectedVM.source === 'missing') && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <strong className="text-gray-600">Disk:</strong> 
                    <span className="text-gray-900 font-medium">
                      {selectedVM.disk_gb || selectedVM.vm_summary?.disk || 'N/A'}
                      {(selectedVM.disk_gb || selectedVM.vm_summary?.disk) && ' GB'}
                    </span>
                  </div>
                )}
                {selectedVM.source === 'vcenter' && selectedVM.guest_os && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <strong className="text-gray-600">Guest OS:</strong> 
                    <span className="text-gray-700 text-xs max-w-[200px] text-right">
                      {selectedVM.guest_os}
                    </span>
                  </div>
                )}
                {selectedVM.source === 'jira' && selectedVM.operating_system && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <strong className="text-gray-600">Operating System:</strong> 
                    <span className="text-gray-700">{selectedVM.operating_system}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Additional Information for Missing VMs */}
          {selectedVM.source === 'missing' && selectedVM.vm_summary && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-2m-2 0H7m14 0V7a2 2 0 00-2-2H7a2 2 0 012 2v14m0 0h2m-2 0v-2m2 2v-2" />
                </svg>
                VM Environment Details
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <strong className="text-gray-600">Site:</strong>
                    <span className="text-gray-700">{selectedVM.vm_summary.site || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong className="text-gray-600">Zone:</strong>
                    <span className="text-gray-700">{selectedVM.vm_summary.zone || 'N/A'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <strong className="text-gray-600">Environment:</strong>
                    <span className="text-gray-700">{selectedVM.vm_summary.environment || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <strong className="text-gray-600">Created:</strong>
                    <span className="text-gray-700">
                      {selectedVM.created_date ? new Date(selectedVM.created_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Debug Information */}
          {selectedVM.debug_info && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Technical Details
              </h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <strong className="text-gray-600">Object Type ID:</strong>
                      <span className="font-mono text-xs text-gray-700">{selectedVM.debug_info.runtime_object_type_id || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong className="text-gray-600">Schema ID:</strong>
                      <span className="font-mono text-xs text-gray-700">{selectedVM.debug_info.runtime_object_schema_id || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <strong className="text-gray-600">Matching Method:</strong>
                      <span className="text-xs text-gray-700">{selectedVM.debug_info.matching_method || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <strong className="text-gray-600">Processing Date:</strong>
                      <span className="text-xs text-gray-700">
                        {selectedVM.debug_info.processing_date ? 
                          new Date(selectedVM.debug_info.processing_date).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={() => setShowVMModal(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VMDetailsModal;

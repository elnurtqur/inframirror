import React from 'react';

const VMDetailsModal = ({ selectedVM, showVMModal, setShowVMModal }) => {
  if (!showVMModal || !selectedVM) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-96 overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {selectedVM.source === 'vcenter' ? 'vCenter' : 'Jira'} VM Details: {selectedVM.name || selectedVM.vm_name}
            </h3>
            <button
              onClick={() => setShowVMModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
              <div className="space-y-2 text-sm">
                <div><strong>Name:</strong> {selectedVM.name || selectedVM.vm_name || 'N/A'}</div>
                {selectedVM.source === 'vcenter' && (
                  <>
                    <div><strong>UUID:</strong> {selectedVM.uuid || 'N/A'}</div>
                    <div><strong>MobID:</strong> {selectedVM.mobid || 'N/A'}</div>
                    <div><strong>Power State:</strong> 
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
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
                    <div><strong>Jira Key:</strong> {selectedVM.jira_object_key || 'N/A'}</div>
                    <div><strong>Jira ID:</strong> {selectedVM.jira_object_id || 'N/A'}</div>
                    <div><strong>Site:</strong> {selectedVM.site || 'N/A'}</div>
                  </>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-3">Hardware</h4>
              <div className="space-y-2 text-sm">
                <div><strong>CPU:</strong> {selectedVM.cpu_count || 'N/A'}</div>
                <div><strong>Memory:</strong> {selectedVM.memory_gb || 'N/A'} GB</div>
                {selectedVM.source === 'jira' && (
                  <div><strong>Disk:</strong> {selectedVM.disk_gb || 'N/A'} GB</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VMDetailsModal;
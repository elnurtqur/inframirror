import React from 'react';
import { CheckCircle, AlertCircle, HardDrive, X } from 'lucide-react';
import LoadingButton from '../common/LoadingButton';

const PostingModal = ({ 
  showPostingModal, 
  setShowPostingModal, 
  selectedVMIds, 
  loading, 
  postSelectedVMsToJira 
}) => {
  if (!showPostingModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Confirm Jira Asset Creation</h3>
            <button
              onClick={() => setShowPostingModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading.selectedJiraPost}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-700 mb-2">
              You are about to create <strong>{selectedVMIds.size}</strong> new VM assets in Jira Asset Management.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Selected VMs will be:</p>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>Created as new assets in Jira</li>
                    <li>Moved to completed status</li>
                    <li>Available in Jira Asset Management</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Please ensure:</p>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>Jira authentication token is valid</li>
                    <li>Network connectivity to Jira server</li>
                    <li>Required permissions for asset creation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowPostingModal(false)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={loading.selectedJiraPost}
            >
              Cancel
            </button>
            <LoadingButton
              loading={loading.selectedJiraPost}
              onClick={postSelectedVMsToJira}
              variant="success"
            >
              <HardDrive className="w-4 h-4" />
              {loading.selectedJiraPost ? 'Creating Assets...' : `Create ${selectedVMIds.size} Assets`}
            </LoadingButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostingModal;
import React from 'react';

// VMID Badge komponenti
const VMIDCard = ({ vmid, size = 'xs' }) => {
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm'
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

const JiraAssetsTab = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* Completed Jira Assets */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-green-700">Completed Jira Assets ({data.completedAssets?.length || 0})</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">Successfully created VM assets in Jira Asset Management</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VM Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <span>VM ID</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jira Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.completedAssets?.length > 0 ? (
                data.completedAssets.slice(0, 15).map((asset, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {asset.vm_name}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <VMIDCard vm={asset} size="xs" />
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <a 
                        href={`https://jira-support.company.com/browse/${asset.jira_object_key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-800 font-medium hover:underline"
                        title="Open in Jira"
                      >
                        {asset.jira_object_key}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4m-8 0h8m-8 0V19a2 2 0 002 2h4a2 2 0 002-2V7" />
                        </svg>
                        {asset.jira_post_date ? new Date(asset.jira_post_date).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                      {asset.vm_summary?.ip || 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium mb-2">No completed assets yet</p>
                      <p className="text-sm">Completed VM assets will appear here after successful Jira posting</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed Jira Assets */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-red-700">Failed Jira Assets ({data.failedAssets?.length || 0})</h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">VM assets that failed during Jira posting process</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VM Name</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[110px]">
                  <div className="flex items-center space-x-1">
                    <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <span>VM ID</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Failure Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retry Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Attempt</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.failedAssets?.length > 0 ? (
                data.failedAssets.slice(0, 15).map((asset, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        {asset.vm_name}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <VMIDCard vmid={asset.vm_summary?.vmid || asset.debug_info?.vmid} size="xs" />
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600">
                      <div className="max-w-xs">
                        <p className="truncate" title={asset.failure_reason}>
                          {asset.failure_reason || 'Unknown error'}
                        </p>
                        {asset.failure_status_code && (
                          <span className="inline-flex mt-1 px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded">
                            HTTP {asset.failure_status_code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {asset.retry_count || 0}
                        {asset.retry_count >= 3 && (
                          <span className="ml-1 text-xs text-red-500">(Max)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {asset.last_attempt ? new Date(asset.last_attempt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                      {asset.vm_summary?.ip || 'N/A'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-lg font-medium mb-2">No failed assets</p>
                      <p className="text-sm">All VM posting attempts have been successful</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assets Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-green-600">Successfully Created</div>
              <div className="text-2xl font-bold text-green-900">{data.completedAssets?.length || 0}</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-lg p-6 border border-red-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-red-600">Creation Failed</div>
              <div className="text-2xl font-bold text-red-900">{data.failedAssets?.length || 0}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JiraAssetsTab;

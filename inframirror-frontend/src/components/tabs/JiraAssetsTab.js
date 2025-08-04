import React from 'react';

const JiraAssetsTab = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-green-700">Completed Jira Assets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VM Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jira Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.completedAssets.slice(0, 10).map((asset, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{asset.vm_name}</td>
                  <td className="px-6 py-4 text-sm text-green-600">{asset.jira_object_key}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {asset.jira_post_date ? new Date(asset.jira_post_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{asset.vm_summary?.ip || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-red-700">Failed Jira Assets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VM Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Failure Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Retry Count</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Attempt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.failedAssets.slice(0, 10).map((asset, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{asset.vm_name}</td>
                  <td className="px-6 py-4 text-sm text-red-600">{asset.failure_reason}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{asset.retry_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {asset.last_attempt ? new Date(asset.last_attempt).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default JiraAssetsTab;
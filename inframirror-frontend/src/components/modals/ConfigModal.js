import React from 'react';
import { Database, Server } from 'lucide-react';

const ConfigModal = ({ showConfigModal, setShowConfigModal, config, setConfig, addLog }) => {
  if (!showConfigModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-96 overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">System Configuration</h3>
            <button
              onClick={() => setShowConfigModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                Jira Asset Management
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API URL
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={config.jira.api_url}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      jira: { ...prev.jira, api_url: e.target.value }
                    }))}
                    placeholder="https://jira-support.company.com/rest/insight/1.0/object/navlist/iql"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bearer Token
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={config.jira.token}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      jira: { ...prev.jira, token: e.target.value }
                    }))}
                    placeholder="Enter Jira Bearer Token"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asset Create URL
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={config.jira.create_url}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      jira: { ...prev.jira, create_url: e.target.value }
                    }))}
                    placeholder="https://jira-support.company.com/rest/insight/1.0/object/create"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Object Type ID
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                      value={config.jira.object_type_id}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        jira: { ...prev.jira, object_type_id: e.target.value }
                      }))}
                      placeholder="3191"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Schema ID
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                      value={config.jira.object_schema_id}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        jira: { ...prev.jira, object_schema_id: e.target.value }
                      }))}
                      placeholder="242"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                VMware vCenter
              </h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">vCenter Host</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={config.vcenter.host}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      vcenter: { ...prev.vcenter, host: e.target.value }
                    }))}
                    placeholder="vcenter.company.com"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={config.vcenter.username}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      vcenter: { ...prev.vcenter, username: e.target.value }
                    }))}
                    placeholder="administrator@vsphere.local"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                    value={config.vcenter.password}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      vcenter: { ...prev.vcenter, password: e.target.value }
                    }))}
                    placeholder="Enter vCenter Password"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t flex justify-between">
            <div className="text-sm text-gray-600">
              <p>💡 Configuration is stored in browser session only</p>
              <p>🔒 Passwords are masked for security</p>
              <p>📋 Object Type ID: VM asset type in Jira Asset Schema</p>
              <p>🗂️ Schema ID: Asset Management schema identifier</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Reset to defaults
                  setConfig({
                    jira: {
                      api_url: 'https://jira-support.company.com/rest/insight/1.0/object/navlist/iql',
                      token: '',
                      create_url: 'https://jira-support.company.com/rest/insight/1.0/object/create',
                      object_type_id: '3191',
                      object_schema_id: '242'
                    },
                    vcenter: {
                      host: 'kb-bnk-bmdc-vc1.company.com',
                      username: '',
                      password: '',
                      port: 443
                    }
                  });
                  addLog('Configuration reset to defaults', 'info');
                }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Reset to Defaults
              </button>
              
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  addLog('Configuration updated successfully', 'success');
                }}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigModal;
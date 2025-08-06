import React from 'react';
import { Database, Server } from 'lucide-react';

const ConfigModal = ({ showConfigModal, setShowConfigModal, config, setConfig, addLog }) => {
  if (!showConfigModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
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

                {/* ✅ YENİ - Default Site və Zone Fields */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h5 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <span className="text-sm bg-blue-600 text-white px-2 py-1 rounded">NEW</span>
                    Default VM Tags
                  </h5>
                  <p className="text-sm text-blue-700 mb-4">
                    Set default Site and Zone values for VMs that don't have these tags in vCenter
                  </p>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-900 mb-1">
                        Default Site
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                        value={config.vcenter.default_site || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          vcenter: { ...prev.vcenter, default_site: e.target.value }
                        }))}
                        placeholder="e.g., Baku_DC, Main_Office, DR_Site"
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        Applied to VMs without Site tag
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-blue-900 mb-1">
                        Default Zone
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                        value={config.vcenter.default_zone || ''}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          vcenter: { ...prev.vcenter, default_zone: e.target.value }
                        }))}
                        placeholder="e.g., Production_Zone, DMZ, Internal_Zone"
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        Applied to VMs without Zone tag
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t">
            {/* Enhanced Information Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="text-sm text-gray-600 space-y-2">
                <p className="font-medium text-gray-700 mb-2">💡 Configuration Notes:</p>
                <p>• Configuration is stored in browser session only</p>
                <p>• Passwords are masked for security</p>
                <p>• Object Type ID: VM asset type in Jira Asset Schema</p>
                <p>• Schema ID: Asset Management schema identifier</p>
              </div>
              
              <div className="text-sm text-blue-600 space-y-2">
                <p className="font-medium text-blue-700 mb-2">🏷️ Default Tags Feature:</p>
                <p>• Site & Zone will be applied to VMs missing these tags</p>
                <p>• Existing VM tags are preserved and prioritized</p>
                <p>• Leave blank to skip default tag assignment</p>
                <p>• Values are shown in collection logs for transparency</p>
              </div>
            </div>
            
            <div className="flex justify-between">
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
                        port: 443,
                        // ✅ YENİ - Default values for Site/Zone
                        default_site: '',
                        default_zone: ''
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
                    // ✅ YENİ - Set common default values
                    setConfig(prev => ({
                      ...prev,
                      vcenter: {
                        ...prev.vcenter,
                        default_site: 'Baku_DC',
                        default_zone: 'Production_Zone'
                      }
                    }));
                    addLog('Applied common default Site/Zone values', 'info');
                  }}
                  className="px-4 py-2 text-sm border border-blue-300 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                >
                  Use Common Defaults
                </button>
              </div>
              
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  
                  // ✅ YENİ - Enhanced success message
                  let message = 'Configuration updated successfully';
                  if (config.vcenter.default_site || config.vcenter.default_zone) {
                    const defaults = [];
                    if (config.vcenter.default_site) defaults.push(`Site: ${config.vcenter.default_site}`);
                    if (config.vcenter.default_zone) defaults.push(`Zone: ${config.vcenter.default_zone}`);
                    message += ` (Default tags: ${defaults.join(', ')})`;
                  }
                  
                  addLog(message, 'success');
                }}
                className="px-6 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
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
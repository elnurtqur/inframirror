import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, Activity, AlertCircle, CheckCircle, Clock, Server, HardDrive, Eye, Search, Filter, Settings } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const VMwareCollectorApp = () => {
  const [loading, setLoading] = useState({});
  const [data, setData] = useState({
    vcenterStats: null,
    jiraStats: null,
    collectionStatus: null,
    missingVMs: [],
    completedAssets: [],
    failedAssets: [],
    vcenterVMs: [],
    jiraVMs: []
  });
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [powerStateFilter, setPowerStateFilter] = useState('all');
  const [selectedVM, setSelectedVM] = useState(null);
  const [showVMModal, setShowVMModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [config, setConfig] = useState({
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

  // Add log entry
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [{
      id: Date.now(),
      timestamp,
      message,
      type
    }, ...prev.slice(0, 49)]);
  };

  // API call wrapper
  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      addLog(`API Error: ${error.message}`, 'error');
      throw error;
    }
  };

  // Load dashboard data
  const loadDashboardData = async () => {
    setLoading(prev => ({...prev, dashboard: true}));
    try {
      const [vcenterStats, jiraStats, collectionStatus] = await Promise.all([
        apiCall('/api/v1/statistics'),
        apiCall('/api/v1/jira-statistics'),
        apiCall('/api/v1/collection-status')
      ]);
      
      setData(prev => ({
        ...prev,
        vcenterStats: vcenterStats.data,
        jiraStats: jiraStats.data,
        collectionStatus: collectionStatus.data
      }));
      
      addLog('Dashboard data loaded successfully', 'success');
    } catch (error) {
      addLog('Failed to load dashboard data', 'error');
    } finally {
      setLoading(prev => ({...prev, dashboard: false}));
    }
  };

  // Collect vCenter VMs
  const collectVCenterVMs = async () => {
    setLoading(prev => ({...prev, vcenter: true}));
    addLog('Starting vCenter VM collection...', 'info');
    
    try {
      const response = await apiCall('/api/v1/collect-vms', {
        method: 'POST',
        body: JSON.stringify({
          vcenter_config: {
            host: config.vcenter.host,
            username: config.vcenter.username,
            password: config.vcenter.password,
            port: config.vcenter.port
          },
          batch_size: 50,
          max_processes: 8
        })
      });
      
      addLog(`vCenter collection completed: ${response.processed_vms} VMs processed`, 'success');
      loadDashboardData();
    } catch (error) {
      addLog('vCenter collection failed', 'error');
    } finally {
      setLoading(prev => ({...prev, vcenter: false}));
    }
  };

  // Collect Jira VMs
  const collectJiraVMs = async () => {
    setLoading(prev => ({...prev, jira: true}));
    addLog('Starting Jira VM collection...', 'info');
    
    try {
      const response = await apiCall('/api/v1/collect-jira-vms', {
        method: 'POST',
        body: JSON.stringify({
          jira_config: {
            api_url: config.jira.api_url,
            token: config.jira.token,
            object_type_id: config.jira.object_type_id,
            object_schema_id: config.jira.object_schema_id
          },
          batch_size: 50,
          max_processes: 8
        })
      });
      
      addLog(`Jira collection completed: ${response.processed_vms} VMs processed`, 'success');
      loadDashboardData();
    } catch (error) {
      addLog('Jira collection failed', 'error');
    } finally {
      setLoading(prev => ({...prev, jira: false}));
    }
  };

  // Process VM Diff
  const processVMDiff = async () => {
    setLoading(prev => ({...prev, diff: true}));
    addLog('Starting VM diff processing (IP-only matching)...', 'info');
    
    try {
      const response = await apiCall('/api/v1/process-vm-diff', {
        method: 'POST',
        body: JSON.stringify({
          jira_config: {
            api_url: config.jira.api_url,
            token: config.jira.token,
            object_type_id: config.jira.object_type_id,
            object_schema_id: config.jira.object_schema_id
          }
        })
      });
      
      addLog(`Diff processing completed: ${response.missing_vms_count} missing VMs found`, 'success');
      loadMissingVMs();
      loadDashboardData();
    } catch (error) {
      addLog('VM diff processing failed', 'error');
    } finally {
      setLoading(prev => ({...prev, diff: false}));
    }
  };

  // Post to Jira
  const postToJira = async () => {
    setLoading(prev => ({...prev, jiraPost: true}));
    addLog('Starting Jira Asset posting...', 'info');
    
    try {
      const response = await apiCall('/api/v1/post-to-jira', {
        method: 'POST',
        body: JSON.stringify({
          jira_config: {
            jira_token: config.jira.token,
            create_url: config.jira.create_url,
            delay_seconds: 1.0
          },
          limit: 10,
          retry_failed: false
        })
      });
      
      addLog(`Jira posting completed: ${response.successful} successful, ${response.failed} failed`, 
             response.failed > 0 ? 'warning' : 'success');
      loadCompletedAssets();
      loadFailedAssets();
      loadMissingVMs();
    } catch (error) {
      addLog('Jira posting failed', 'error');
    } finally {
      setLoading(prev => ({...prev, jiraPost: false}));
    }
  };

  // Load missing VMs
  const loadMissingVMs = async () => {
    try {
      const response = await apiCall('/api/v1/get-all-missing-vms-from-db?limit=100');
      setData(prev => ({...prev, missingVMs: response.vms || []}));
    } catch (error) {
      addLog('Failed to load missing VMs', 'error');
    }
  };

  // Load completed assets
  const loadCompletedAssets = async () => {
    try {
      const response = await apiCall('/api/v1/completed-jira-assets?limit=50');
      setData(prev => ({...prev, completedAssets: response.assets || []}));
    } catch (error) {
      addLog('Failed to load completed assets', 'error');
    }
  };

  // Load failed assets
  const loadFailedAssets = async () => {
    try {
      const response = await apiCall('/api/v1/failed-jira-assets?limit=50');
      setData(prev => ({...prev, failedAssets: response.assets || []}));
    } catch (error) {
      addLog('Failed to load failed assets', 'error');
    }
  };

  // Load vCenter VMs
  const loadVCenterVMs = async (search = '', limit = 100) => {
    try {
      let endpoint = `/api/v1/get-all-vms-from-db?limit=${limit}`;
      if (search) {
        endpoint += `&search=${encodeURIComponent(search)}`;
      }
      
      const response = await apiCall(endpoint);
      setData(prev => ({...prev, vcenterVMs: response.vms || []}));
      addLog(`Loaded ${response.vms?.length || 0} vCenter VMs`, 'success');
    } catch (error) {
      addLog('Failed to load vCenter VMs', 'error');
    }
  };

  // Load Jira VMs
  const loadJiraVMs = async (limit = 100) => {
    try {
      const response = await apiCall(`/api/v1/get-all-jira-vms-from-db?limit=${limit}`);
      setData(prev => ({...prev, jiraVMs: response.vms || []}));
      addLog(`Loaded ${response.vms?.length || 0} Jira VMs`, 'success');
    } catch (error) {
      addLog('Failed to load Jira VMs', 'error');
    }
  };

  // Filter vCenter VMs
  const getFilteredVCenterVMs = () => {
    return data.vcenterVMs.filter(vm => {
      const matchesSearch = !searchTerm || 
        vm.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vm.ip_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vm.guest_hostname?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPowerState = powerStateFilter === 'all' || vm.power_state === powerStateFilter;
      
      return matchesSearch && matchesPowerState;
    });
  };

  // Filter Jira VMs
  const getFilteredJiraVMs = () => {
    return data.jiraVMs.filter(vm => {
      return !searchTerm || 
        vm.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vm.ip_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vm.vm_name?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  };

  // Show VM details modal
  const showVMDetails = (vm, source) => {
    setSelectedVM({...vm, source});
    setShowVMModal(true);
  };

  // Initial load
  useEffect(() => {
    loadDashboardData();
    loadMissingVMs();
    loadCompletedAssets();
    loadFailedAssets();
    loadVCenterVMs();
    loadJiraVMs();
  }, []);

  const LoadingButton = ({ loading, onClick, children, variant = 'primary' }) => {
    const baseClasses = "px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors disabled:opacity-50";
    const variantClasses = {
      primary: "bg-blue-600 hover:bg-blue-700 text-white",
      success: "bg-green-600 hover:bg-green-700 text-white",
      warning: "bg-orange-600 hover:bg-orange-700 text-white",
      danger: "bg-red-600 hover:bg-red-700 text-white"
    };
    
    return (
      <button
        className={`${baseClasses} ${variantClasses[variant]}`}
        onClick={onClick}
        disabled={loading}
      >
        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
        {children}
      </button>
    );
  };

  const StatCard = ({ title, value, icon: Icon, color = "blue" }) => (
    <div className={`bg-white rounded-lg shadow-sm border-l-4 border-${color}-500 p-4`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value || '0'}</p>
        </div>
        <Icon className={`w-8 h-8 text-${color}-500`} />
      </div>
    </div>
  );

  const LogEntry = ({ log }) => {
    const typeStyles = {
      info: 'bg-blue-50 border-blue-200 text-blue-800',
      success: 'bg-green-50 border-green-200 text-green-800',
      warning: 'bg-orange-50 border-orange-200 text-orange-800',
      error: 'bg-red-50 border-red-200 text-red-800'
    };

    const icons = {
      info: AlertCircle,
      success: CheckCircle,
      warning: AlertCircle,
      error: AlertCircle
    };

    const Icon = icons[log.type];

    return (
      <div className={`border rounded-lg p-3 ${typeStyles[log.type]}`}>
        <div className="flex items-start gap-2">
          <Icon className="w-4 h-4 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{log.timestamp}</span>
            </div>
            <p className="text-sm mt-1">{log.message}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">VMware Collector</h1>
                <p className="text-sm text-gray-600">vCenter & Jira Asset Management Integration</p>
              </div>
            </div>
            <div className="flex gap-2">
              <LoadingButton
                loading={loading.dashboard}
                onClick={loadDashboardData}
                variant="primary"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </LoadingButton>
              
              <button
                onClick={() => setShowConfigModal(true)}
                className="px-4 py-2 rounded-lg flex items-center gap-2 font-medium bg-gray-600 hover:bg-gray-700 text-white transition-colors"
              >
                <Settings className="w-4 h-4" />
                Configuration
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8">
            {['dashboard', 'operations', 'vm-summary', 'missing-vms', 'jira-assets', 'logs'].map((tab) => (
              <button
                key={tab}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="vCenter VMs"
                value={data.vcenterStats?.total_vms}
                icon={Server}
                color="blue"
              />
              <StatCard
                title="Jira VMs"
                value={data.jiraStats?.total_jira_vms}
                icon={Database}
                color="green"
              />
              <StatCard
                title="Missing VMs"
                value={data.collectionStatus?.missing_vms_count}
                icon={AlertCircle}
                color="orange"
              />
              <StatCard
                title="Match Rate"
                value={data.vcenterStats?.total_vms && data.collectionStatus?.missing_vms_count 
                  ? `${Math.round((1 - data.collectionStatus.missing_vms_count / data.vcenterStats.total_vms) * 100)}%`
                  : 'N/A'}
                icon={Activity}
                color="purple"
              />
            </div>

            {/* Power State Distribution */}
            {data.vcenterStats?.power_state_distribution && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">vCenter VM Power States</h3>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(data.vcenterStats.power_state_distribution).map(([state, count]) => (
                    <div key={state} className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{count}</div>
                      <div className="text-sm text-gray-600 capitalize">{state}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-6">Data Collection & Processing</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* vCenter Operations */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">vCenter Operations</h4>
                  <LoadingButton
                    loading={loading.vcenter}
                    onClick={collectVCenterVMs}
                    variant="primary"
                  >
                    <Server className="w-4 h-4" />
                    Collect vCenter VMs
                  </LoadingButton>
                </div>

                {/* Jira Operations */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Jira Operations</h4>
                  <LoadingButton
                    loading={loading.jira}
                    onClick={collectJiraVMs}
                    variant="success"
                  >
                    <Database className="w-4 h-4" />
                    Collect Jira VMs
                  </LoadingButton>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t">
                <h4 className="font-medium text-gray-900 mb-4">Processing Operations</h4>
                <div className="flex flex-wrap gap-4">
                  <LoadingButton
                    loading={loading.diff}
                    onClick={processVMDiff}
                    variant="warning"
                  >
                    <Activity className="w-4 h-4" />
                    Process VM Diff (IP-only)
                  </LoadingButton>
                  
                  <LoadingButton
                    loading={loading.jiraPost}
                    onClick={postToJira}
                    variant="success"
                  >
                    <HardDrive className="w-4 h-4" />
                    Post to Jira Assets
                  </LoadingButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VM Summary Tab */}
        {activeTab === 'vm-summary' && (
          <div className="space-y-6">
            {/* Search and Filter Controls */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex flex-col md:flex-row gap-4">
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
                <div className="flex gap-2">
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
                  <LoadingButton
                    loading={false}
                    onClick={() => {
                      loadVCenterVMs(searchTerm);
                      loadJiraVMs();
                    }}
                    variant="primary"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </LoadingButton>
                </div>
              </div>
            </div>

            {/* vCenter VMs Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-blue-700">vCenter VMs ({getFilteredVCenterVMs().length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VM Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Power State</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest OS</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getFilteredVCenterVMs().slice(0, 50).map((vm, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{vm.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vm.ip_address || 'N/A'}</td>
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
                        <td className="px-6 py-4 text-sm text-gray-500">{vm.cpu_count || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vm.memory_gb || 'N/A'} GB</td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{vm.guest_os || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => showVMDetails(vm, 'vcenter')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {getFilteredVCenterVMs().length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No vCenter VMs found
                  </div>
                )}
              </div>
            </div>

            {/* Jira VMs Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-green-700">Jira Asset VMs ({getFilteredJiraVMs().length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VM Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jira Key</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">OS</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {getFilteredJiraVMs().slice(0, 50).map((vm, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{vm.name || vm.vm_name}</td>
                        <td className="px-6 py-4 text-sm text-blue-600">{vm.jira_object_key}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vm.ip_address || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vm.cpu_count || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vm.memory_gb || 'N/A'} GB</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{vm.operating_system || 'N/A'}</td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => showVMDetails(vm, 'jira')}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {getFilteredJiraVMs().length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No Jira VMs found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Missing VMs Tab */}
        {activeTab === 'missing-vms' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Missing VMs</h3>
                <button
                  onClick={loadMissingVMs}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VM Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.missingVMs.map((vm, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{vm.vm_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{vm.vm_summary?.ip || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{vm.vm_summary?.cpu || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{vm.vm_summary?.memory || 'N/A'} GB</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          vm.status === 'pending_creation' 
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {vm.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {data.missingVMs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No missing VMs found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Jira Assets Tab */}
        {activeTab === 'jira-assets' && (
          <div className="space-y-6">
            {/* Completed Assets */}
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

            {/* Failed Assets */}
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
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Activity Logs</h3>
                <button
                  onClick={() => setLogs([])}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Clear Logs
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No logs yet. Start by performing operations.
                </div>
              ) : (
                logs.map((log) => (
                  <LogEntry key={log.id} log={log} />
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* VM Details Modal */}
      {showVMModal && selectedVM && (
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
                {/* Basic Information */}
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

                {/* Hardware Information */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Hardware</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>CPU:</strong> {selectedVM.cpu_count || 'N/A'}</div>
                    <div><strong>Memory:</strong> {selectedVM.memory_gb || 'N/A'} GB</div>
                    {selectedVM.source === 'jira' && (
                      <div><strong>Disk:</strong> {selectedVM.disk_gb || 'N/A'} GB</div>
                    )}
                    {selectedVM.disks && selectedVM.disks.length > 0 && (
                      <div>
                        <strong>Disks:</strong>
                        <ul className="ml-4 mt-1">
                          {selectedVM.disks.slice(0, 3).map((disk, idx) => (
                            <li key={idx}>• {disk.label}: {disk.capacity_gb} GB</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Network Information */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Network</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Primary IP:</strong> {selectedVM.ip_address || 'N/A'}</div>
                    {selectedVM.source === 'jira' && (
                      <>
                        <div><strong>Secondary IP:</strong> {selectedVM.secondary_ip || 'N/A'}</div>
                        <div><strong>Secondary IP 2:</strong> {selectedVM.secondary_ip2 || 'N/A'}</div>
                      </>
                    )}
                    {selectedVM.guest_ip_addresses && selectedVM.guest_ip_addresses.length > 0 && (
                      <div>
                        <strong>Guest IPs:</strong>
                        <ul className="ml-4 mt-1">
                          {selectedVM.guest_ip_addresses.slice(0, 5).map((ip, idx) => (
                            <li key={idx}>• {ip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedVM.guest_hostname && (
                      <div><strong>Hostname:</strong> {selectedVM.guest_hostname}</div>
                    )}
                  </div>
                </div>

                {/* Operating System */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Operating System</h4>
                  <div className="space-y-2 text-sm">
                    {selectedVM.source === 'vcenter' ? (
                      <>
                        <div><strong>Guest OS:</strong> {selectedVM.guest_os || 'N/A'}</div>
                        <div><strong>Guest Full Name:</strong> {selectedVM.guest_os_full_name || 'N/A'}</div>
                        <div><strong>Tools Status:</strong> {selectedVM.tools_status || 'N/A'}</div>
                        <div><strong>Tools Version:</strong> {selectedVM.tools_version || 'N/A'}</div>
                      </>
                    ) : (
                      <>
                        <div><strong>Operating System:</strong> {selectedVM.operating_system || 'N/A'}</div>
                        <div><strong>Platform:</strong> {selectedVM.platform || 'N/A'}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {selectedVM.tags && selectedVM.tags.length > 0 && (
                  <div className="md:col-span-2">
                    <h4 className="font-medium text-gray-900 mb-3">Tags</h4>
                    <div className="space-y-2">
                      {selectedVM.tags.map((tagGroup, idx) => (
                        <div key={idx} className="flex flex-wrap gap-2">
                          {Object.entries(tagGroup).map(([key, value]) => (
                            <span key={key} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Infrastructure (vCenter only) */}
                {selectedVM.source === 'vcenter' && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Infrastructure</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Host:</strong> {selectedVM.host_name || 'N/A'}</div>
                      <div><strong>Resource Pool:</strong> {selectedVM.resource_pool || 'N/A'}</div>
                      <div><strong>Folder:</strong> {selectedVM.folder_name || 'N/A'}</div>
                      {selectedVM.datastores && selectedVM.datastores.length > 0 && (
                        <div>
                          <strong>Datastores:</strong>
                          <ul className="ml-4 mt-1">
                            {selectedVM.datastores.slice(0, 3).map((ds, idx) => (
                              <li key={idx}>• {ds.name} ({ds.capacity_gb} GB, {ds.free_space_gb} GB free)</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Management (Jira only) */}
                {selectedVM.source === 'jira' && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Management</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Description:</strong> {selectedVM.description || 'N/A'}</div>
                      <div><strong>Created By:</strong> {selectedVM.created_by || 'N/A'}</div>
                      <div><strong>Criticality:</strong> {selectedVM.criticality_level || 'N/A'}</div>
                      <div><strong>Need Backup:</strong> {selectedVM.need_backup || 'N/A'}</div>
                      <div><strong>Need Monitoring:</strong> {selectedVM.need_monitoring || 'N/A'}</div>
                      {selectedVM.responsible_ttl && (
                        <div><strong>Responsible:</strong> {selectedVM.responsible_ttl.display_name || selectedVM.responsible_ttl.name || 'N/A'}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium text-gray-900 mb-3">Metadata</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><strong>Created:</strong> {selectedVM.created_date ? new Date(selectedVM.created_date).toLocaleString() : 'N/A'}</div>
                  <div><strong>Last Updated:</strong> {selectedVM.last_updated ? new Date(selectedVM.last_updated).toLocaleString() : 'N/A'}</div>
                  <div><strong>Data Source:</strong> {selectedVM.data_source || selectedVM.source}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && (
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
                {/* Jira Configuration */}
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

                {/* vCenter Configuration */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <Server className="w-5 h-5 text-blue-600" />
                    VMware vCenter
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        vCenter Host
                      </label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Username
                      </label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                      </label>
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
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Port
                      </label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                        value={config.vcenter.port}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          vcenter: { ...prev.vcenter, port: parseInt(e.target.value) || 443 }
                        }))}
                        placeholder="443"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration Actions */}
              <div className="mt-8 pt-6 border-t flex justify-between">
                <div className="text-sm text-gray-600">
                  <p>💡 Configuration is stored in browser session only</p>
                  <p>🔒 Passwords are masked for security</p>
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
      )}
    </div>
  );
};

export default VMwareCollectorApp;
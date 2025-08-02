import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, Activity, AlertCircle, CheckCircle, Clock, Server, HardDrive, Eye, Search, Filter, Settings, ChevronUp, ChevronDown, Power, PowerOff, Pause, ChevronLeft, ChevronRight } from 'lucide-react';

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
  
  // VM Summary pagination and filtering states
  const [vmDataSource, setVmDataSource] = useState('vcenter'); // 'vcenter' or 'jira'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Selective VM posting states
  const [selectedVMIds, setSelectedVMIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showPostingModal, setShowPostingModal] = useState(false);
  
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

  // Load VMs based on current data source and pagination
  const loadVMs = async () => {
    setLoading(prev => ({...prev, vms: true}));
    try {
      const skip = (currentPage - 1) * itemsPerPage;
      let endpoint;
      
      if (vmDataSource === 'vcenter') {
        endpoint = `/api/v1/get-all-vms-from-db?skip=${skip}&limit=${itemsPerPage}`;
        if (searchTerm) {
          endpoint += `&search=${encodeURIComponent(searchTerm)}`;
        }
        
        const response = await apiCall(endpoint);
        setData(prev => ({
          ...prev,
          vcenterVMs: response.vms || [],
          vcenterTotalCount: response.total_count || 0
        }));
      } else {
        endpoint = `/api/v1/get-all-jira-vms-from-db?skip=${skip}&limit=${itemsPerPage}`;
        
        const response = await apiCall(endpoint);
        setData(prev => ({
          ...prev,
          jiraVMs: response.vms || [],
          jiraTotalCount: response.total_count || 0
        }));
      }
      
      addLog(`Loaded ${vmDataSource === 'vcenter' ? 'vCenter' : 'Jira'} VMs successfully`, 'success');
    } catch (error) {
      addLog(`Failed to load ${vmDataSource === 'vcenter' ? 'vCenter' : 'Jira'} VMs`, 'error');
    } finally {
      setLoading(prev => ({...prev, vms: false}));
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
      loadDashboardData();
    } catch (error) {
      addLog('Jira posting failed', 'error');
    } finally {
      setLoading(prev => ({...prev, jiraPost: false}));
    }
  };

  // Filter and sort VMs
  const getFilteredAndSortedVMs = () => {
    const vms = vmDataSource === 'vcenter' ? data.vcenterVMs : data.jiraVMs;
    
    let filtered = vms.filter(vm => {
      const matchesSearch = !searchTerm || 
        vm.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vm.ip_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vm.vm_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vm.guest_hostname?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesPowerState = vmDataSource === 'jira' || powerStateFilter === 'all' || vm.power_state === powerStateFilter;
      
      return matchesSearch && matchesPowerState;
    });

    // Sort VMs
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle different field types
      if (sortField === 'cpu_count' || sortField === 'memory_gb') {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      } else {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  // Pagination calculations
  const getCurrentVMs = () => {
    return getFilteredAndSortedVMs();
  };

  const getTotalCount = () => {
    return vmDataSource === 'vcenter' ? (data.vcenterTotalCount || 0) : (data.jiraTotalCount || 0);
  };

  const getTotalPages = () => {
    return Math.ceil(getTotalCount() / itemsPerPage);
  };

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Show VM details modal
  const showVMDetails = (vm, source) => {
    setSelectedVM({...vm, source});
    setShowVMModal(true);
  };

  // Page change handler
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Data source change handler
  const handleDataSourceChange = (newSource) => {
    setVmDataSource(newSource);
    setCurrentPage(1);
  };

  // Items per page change handler
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(parseInt(newItemsPerPage));
    setCurrentPage(1);
  };

  // Load missing VMs
  const loadMissingVMs = async () => {
    try {
      const response = await apiCall('/api/v1/get-missing-vms-with-selection?limit=100');
      setData(prev => ({...prev, missingVMs: response.vms || []}));
      addLog(`Loaded ${response.vms?.length || 0} missing VMs`, 'success');
      // Reset selections when data changes
      setSelectedVMIds(new Set());
      setSelectAll(false);
    } catch (error) {
      addLog('Failed to load missing VMs', 'error');
    }
  };

  // Post selected VMs to Jira
  const postSelectedVMsToJira = async () => {
    if (selectedVMIds.size === 0) {
      addLog('No VMs selected for posting', 'warning');
      return;
    }

    setLoading(prev => ({...prev, selectedJiraPost: true}));
    addLog(`Starting Jira Asset posting for ${selectedVMIds.size} selected VMs...`, 'info');
    
    try {
      const response = await apiCall('/api/v1/post-selected-vms-to-jira', {
        method: 'POST',
        body: JSON.stringify({
          jira_config: {
            jira_token: config.jira.token,
            create_url: config.jira.create_url,
            delay_seconds: 1.0
          },
          vm_ids: Array.from(selectedVMIds),
          delay_seconds: 1.0
        })
      });
      
      addLog(`Selected VMs posting completed: ${response.successful} successful, ${response.failed} failed`, 
             response.failed > 0 ? 'warning' : 'success');
      
      // Refresh data and reset selections
      loadMissingVMs();
      loadDashboardData();
      setShowPostingModal(false);
      
    } catch (error) {
      addLog('Selected VMs Jira posting failed', 'error');
    } finally {
      setLoading(prev => ({...prev, selectedJiraPost: false}));
    }
  };

  // Handle individual VM selection
  const handleVMSelection = (vmId, isSelected) => {
    const newSelected = new Set(selectedVMIds);
    if (isSelected) {
      newSelected.add(vmId);
    } else {
      newSelected.delete(vmId);
    }
    setSelectedVMIds(newSelected);
    
    // Update select all state
    setSelectAll(newSelected.size === data.missingVMs.length && data.missingVMs.length > 0);
  };

  // Handle select all
  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      const allIds = new Set(data.missingVMs.filter(vm => vm.status === 'pending_creation').map(vm => vm.id));
      setSelectedVMIds(allIds);
    } else {
      setSelectedVMIds(new Set());
    }
    setSelectAll(isSelected);
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

  // Load VMs when dependencies change
  useEffect(() => {
    if (activeTab === 'vm-summary') {
      loadVMs();
    } else if (activeTab === 'missing-vms') {
      loadMissingVMs();
    } else if (activeTab === 'jira-assets') {
      loadCompletedAssets();
      loadFailedAssets();
    }
  }, [vmDataSource, currentPage, itemsPerPage, activeTab]);

  // Initial load
  useEffect(() => {
    loadDashboardData();
    loadMissingVMs();
    loadCompletedAssets();
    loadFailedAssets();
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
    <div className="bg-white rounded-lg shadow-sm border-l-4 border-blue-500 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value || '0'}</p>
        </div>
        <Icon className="w-8 h-8 text-blue-500" />
      </div>
    </div>
  );

  const PowerStateCard = ({ state, count, icon: Icon, color }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-3 rounded-full ${color === 'green' ? 'bg-green-100' : color === 'red' ? 'bg-red-100' : 'bg-yellow-100'}`}>
            <Icon className={`w-6 h-6 ${color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-yellow-600'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 capitalize">{state}</p>
            <p className="text-2xl font-bold text-gray-900">{count || 0}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-xs font-medium px-2 py-1 rounded-full ${color === 'green' ? 'text-green-600 bg-green-100' : color === 'red' ? 'text-red-600 bg-red-100' : 'text-yellow-600 bg-yellow-100'}`}>
            {data.vcenterStats?.total_vms ? 
              Math.round((count / data.vcenterStats.total_vms) * 100) : 0}%
          </div>
        </div>
      </div>
    </div>
  );

  const SortableHeader = ({ field, children }) => (
    <th 
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortDirection === 'asc' ? 
            <ChevronUp className="w-4 h-4" /> : 
            <ChevronDown className="w-4 h-4" />
        )}
      </div>
    </th>
  );

  const Pagination = () => {
    const totalPages = getTotalPages();
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, getTotalCount());

    return (
      <div className="flex items-center justify-between px-6 py-4 bg-white border-t">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-700">
            Showing {startItem}-{endItem} of {getTotalCount()} results
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => handleItemsPerPageChange(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="10">10 per page</option>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {[...Array(Math.min(5, totalPages))].map((_, index) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = index + 1;
            } else if (currentPage <= 3) {
              pageNum = index + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + index;
            } else {
              pageNum = currentPage - 2 + index;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 py-1 text-sm border rounded ${
                  currentPage === pageNum
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

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
                <h3 className="text-lg font-semibold mb-6">vCenter VM Power States</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <PowerStateCard
                    state="powered on"
                    count={data.vcenterStats.power_state_distribution.poweredOn}
                    icon={Power}
                    color="green"
                  />
                  <PowerStateCard
                    state="powered off"
                    count={data.vcenterStats.power_state_distribution.poweredOff}
                    icon={PowerOff}
                    color="red"
                  />
                  <PowerStateCard
                    state="suspended"
                    count={data.vcenterStats.power_state_distribution.suspended}
                    icon={Pause}
                    color="yellow"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            {/* Operations Overview */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-6 border border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="w-8 h-8 text-blue-600" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Data Collection & Processing</h2>
                  <p className="text-sm text-gray-600">Manage your vCenter and Jira Asset Management integration</p>
                </div>
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">vCenter VMs</div>
                  <div className="text-lg font-bold text-blue-600">{data.vcenterStats?.total_vms || 0}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">Jira Assets</div>
                  <div className="text-lg font-bold text-green-600">{data.jiraStats?.total_jira_vms || 0}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">Missing VMs</div>
                  <div className="text-lg font-bold text-orange-600">{data.collectionStatus?.missing_vms_count || 0}</div>
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-500">Sync Rate</div>
                  <div className="text-lg font-bold text-purple-600">
                    {data.vcenterStats?.total_vms && data.collectionStatus?.missing_vms_count 
                      ? `${Math.round((1 - data.collectionStatus.missing_vms_count / data.vcenterStats.total_vms) * 100)}%`
                      : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Step-by-Step Workflow */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Workflow Steps
                </h3>
                <p className="text-sm text-gray-600 mt-1">Follow these steps to synchronize your infrastructure</p>
              </div>

              <div className="p-6 space-y-6">
                {/* Step 1: Collect vCenter VMs */}
                <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Server className="w-5 h-5 text-blue-600" />
                      Collect vCenter VMs
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Connect to vCenter server and collect all virtual machine information including hardware specs, network details, and tags.
                    </p>
                    <div className="flex items-center gap-3">
                      <LoadingButton
                        loading={loading.vcenter}
                        onClick={collectVCenterVMs}
                        variant="primary"
                      >
                        <Server className="w-4 h-4" />
                        {loading.vcenter ? 'Collecting...' : 'Start Collection'}
                      </LoadingButton>
                      <div className="text-xs text-gray-500">
                        ⏱️ Estimated time: 2-5 minutes
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {data.vcenterStats?.total_vms > 0 ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Step 2: Collect Jira VMs */}
                <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Database className="w-5 h-5 text-green-600" />
                      Collect Jira Asset VMs
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Fetch existing VM assets from Jira Asset Management to compare with vCenter inventory.
                    </p>
                    <div className="flex items-center gap-3">
                      <LoadingButton
                        loading={loading.jira}
                        onClick={collectJiraVMs}
                        variant="success"
                      >
                        <Database className="w-4 h-4" />
                        {loading.jira ? 'Collecting...' : 'Start Collection'}
                      </LoadingButton>
                      <div className="text-xs text-gray-500">
                        ⏱️ Estimated time: 1-3 minutes
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {data.jiraStats?.total_jira_vms > 0 ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Step 3: Process VM Diff */}
                <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-orange-600" />
                      Analyze Differences
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Compare vCenter and Jira inventories using IP-based matching to identify missing VMs that need to be added to Jira.
                    </p>
                    <div className="flex items-center gap-3">
                      <LoadingButton
                        loading={loading.diff}
                        onClick={processVMDiff}
                        variant="warning"
                      >
                        <Activity className="w-4 h-4" />
                        {loading.diff ? 'Analyzing...' : 'Start Analysis'}
                      </LoadingButton>
                      <div className="text-xs text-gray-500">
                        ⏱️ Estimated time: 30 seconds
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {data.collectionStatus?.missing_vms_count !== undefined ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Step 4: Post to Jira */}
                <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-purple-600" />
                      Create Jira Assets
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Automatically create Jira Asset entries for missing VMs with proper tags, hardware specs, and metadata.
                    </p>
                    <div className="flex items-center gap-3">
                      <LoadingButton
                        loading={loading.jiraPost}
                        onClick={postToJira}
                        variant="success"
                      >
                        <HardDrive className="w-4 h-4" />
                        {loading.jiraPost ? 'Creating Assets...' : 'Create Assets'}
                      </LoadingButton>
                      <div className="text-xs text-gray-500">
                        ⏱️ Estimated time: 1-2 minutes
                      </div>
                      <div className="text-xs text-orange-600">
                        ⚠️ Limited to 10 VMs per batch
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-blue-600" />
                  Quick Actions
                </h3>
                <p className="text-sm text-gray-600 mt-1">Common operations for system maintenance</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Full Sync */}
                  <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                    <h4 className="font-medium text-gray-900 mb-2">🔄 Full Synchronization</h4>
                    <p className="text-sm text-gray-600 mb-3">Run complete workflow: collect, analyze, and sync</p>
                    <button
                      onClick={async () => {
                        addLog('Starting full synchronization workflow...', 'info');
                        await collectVCenterVMs();
                        await collectJiraVMs();
                        await processVMDiff();
                      }}
                      disabled={loading.vcenter || loading.jira || loading.diff}
                      className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      Start Full Sync
                    </button>
                  </div>

                  {/* Refresh Data */}
                  <div className="p-4 border border-gray-200 rounded-lg hover:border-green-300 transition-colors">
                    <h4 className="font-medium text-gray-900 mb-2">📊 Refresh Dashboard</h4>
                    <p className="text-sm text-gray-600 mb-3">Update statistics and current status</p>
                    <LoadingButton
                      loading={loading.dashboard}
                      onClick={loadDashboardData}
                      variant="success"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh Data
                    </LoadingButton>
                  </div>

                  {/* Configuration */}
                  <div className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                    <h4 className="font-medium text-gray-900 mb-2">⚙️ System Settings</h4>
                    <p className="text-sm text-gray-600 mb-3">Configure vCenter and Jira connections</p>
                    <button
                      onClick={() => setShowConfigModal(true)}
                      className="w-full px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                      <Settings className="w-4 h-4 inline mr-2" />
                      Open Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Connection Status */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Connection Status</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">vCenter Server</span>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                          {config.vcenter.host ? '🟢 Configured' : '🔴 Not Configured'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">Jira Asset API</span>
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                          {config.jira.token ? '🟢 Configured' : '🔴 Not Configured'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Last Operations */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Recent Activity</h4>
                    <div className="space-y-2">
                      {logs.slice(0, 3).map((log, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs">
                          <div className={`w-2 h-2 rounded-full ${
                            log.type === 'success' ? 'bg-green-500' :
                            log.type === 'error' ? 'bg-red-500' :
                            log.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}></div>
                          <span className="text-gray-600">{log.timestamp}</span>
                          <span className="flex-1 truncate">{log.message}</span>
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <div className="text-sm text-gray-500 italic">No recent activity</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VM Summary Tab */}
        {activeTab === 'vm-summary' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Data Source Selector */}
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">Data Source:</label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDataSourceChange('vcenter')}
                      className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                        vmDataSource === 'vcenter'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      vCenter VMs
                    </button>
                    <button
                      onClick={() => handleDataSourceChange('jira')}
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
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <SortableHeader field="name">VM Name</SortableHeader>
                      <SortableHeader field="ip_address">IP Address</SortableHeader>
                      {vmDataSource === 'vcenter' && (
                        <SortableHeader field="power_state">Power State</SortableHeader>
                      )}
                      {vmDataSource === 'jira' && (
                        <SortableHeader field="jira_object_key">Jira Key</SortableHeader>
                      )}
                      <SortableHeader field="cpu_count">CPU</SortableHeader>
                      <SortableHeader field="memory_gb">Memory</SortableHeader>
                      {vmDataSource === 'vcenter' && (
                        <SortableHeader field="guest_os">Guest OS</SortableHeader>
                      )}
                      {vmDataSource === 'jira' && (
                        <SortableHeader field="operating_system">OS</SortableHeader>
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
              {getTotalCount() > 0 && <Pagination />}
            </div>
          </div>
        )}

        {/* Missing VMs Tab */}
        {activeTab === 'missing-vms' && (
          <div className="space-y-6">
            {/* Selection Actions Panel */}
            {data.missingVMs.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
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

                  <div className="flex items-center space-x-2">
                    <LoadingButton
                      loading={loading.missingVMs}
                      onClick={loadMissingVMs}
                      variant="primary"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Refresh
                    </LoadingButton>
                    
                    {selectedVMIds.size > 0 && (
                      <button
                        onClick={() => setShowPostingModal(true)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 font-medium transition-colors"
                      >
                        <HardDrive className="w-4 h-4" />
                        Post Selected ({selectedVMIds.size})
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Missing VMs Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-orange-700">Missing VMs ({data.missingVMs.length})</h3>
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
                <table className="w-full">
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">VM Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CPU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memory (GB)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disk (GB)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Environment</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.missingVMs.map((vm, index) => {
                      const isSelectable = vm.status === 'pending_creation';
                      const isSelected = selectedVMIds.has(vm.id);
                      
                      return (
                        <tr 
                          key={vm.id || index} 
                          className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-blue-200' : ''} ${!isSelectable ? 'opacity-60' : ''}`}
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
                            {vm.vm_name}
                            {isSelected && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Selected
                              </span>
                            )}
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                
                {loading.missingVMs ? (
                  <div className="text-center py-8 text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading missing VMs...
                  </div>
                ) : data.missingVMs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium mb-2">No missing VMs found</p>
                    <p className="text-sm">All vCenter VMs are properly registered in Jira Asset Management</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Jira Assets Tab */}
        {activeTab === 'jira-assets' && (
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
      )}
    </div>
  );
};

export default VMwareCollectorApp;
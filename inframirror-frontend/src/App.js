import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  Server, 
  Settings,
  AlertTriangle
} from 'lucide-react';

// Components
import LoadingButton from './components/common/LoadingButton';
import DashboardTab from './components/tabs/DashboardTab';
import OperationsTab from './components/tabs/OperationsTab';
import VMSummaryTab from './components/tabs/VMSummaryTab';
import MissingVMsTab from './components/tabs/MissingVMsTab';
import JiraAssetsTab from './components/tabs/JiraAssetsTab';
import LogsTab from './components/tabs/LogsTab';
import EnhancedVMDetailsModal from './components/modals/EnhancedVMDetailsModal';
import ConfigModal from './components/modals/ConfigModal';
import PostingModal from './components/modals/PostingModal';

// Hooks
import { useApi } from './hooks/useApi';
import { useConfig } from './hooks/useConfig';





const VMwareCollectorApp = () => {
  const { loading, setLoadingState, apiCall, addLog } = useApi();
  const { config, setConfig, isConfigComplete, isConfigLoaded, getApiConfig } = useConfig();
  
  // State
  const [data, setData] = useState({
    vcenterStats: null,
    jiraStats: null,
    collectionStatus: null,
    missingVMs: [],
    totalMissingCount: 0,
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
  const [vmDataSource, setVmDataSource] = useState('vcenter');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  
  // Selective VM posting states
  const [selectedVMIds, setSelectedVMIds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [showPostingModal, setShowPostingModal] = useState(false);
  
  // Missing VMs specific states
  const [statusFilter, setStatusFilter] = useState('all');

  // Show config modal if configuration is incomplete on first load
  useEffect(() => {
    if (isConfigLoaded && !isConfigComplete()) {
      setShowConfigModal(true);
    }
  }, [isConfigLoaded, isConfigComplete]);

  // Load dashboard data
  const loadDashboardData = async () => {
    setLoadingState('dashboard', true);
    try {
      const [vcenterStats, jiraStats, collectionStatus] = await Promise.all([
        apiCall('/api/v1/statistics', {}, logs, setLogs),
        apiCall('/api/v1/jira-statistics', {}, logs, setLogs),
        apiCall('/api/v1/collection-status', {}, logs, setLogs)
      ]);
      
      setData(prev => ({
        ...prev,
        vcenterStats: vcenterStats.data,
        jiraStats: jiraStats.data,
        collectionStatus: collectionStatus.data
      }));
      
      addLog('Dashboard data loaded successfully', 'success', logs, setLogs);
    } catch (error) {
      addLog('Failed to load dashboard data', 'error', logs, setLogs);
    } finally {
      setLoadingState('dashboard', false);
    }
  };

  // Load VMs based on current data source and pagination
  const loadVMs = async () => {
    setLoadingState('vms', true);
    try {
      const skip = (currentPage - 1) * itemsPerPage;
      let endpoint;
      
      if (vmDataSource === 'vcenter') {
        endpoint = `/api/v1/get-all-vms-from-db?skip=${skip}&limit=${itemsPerPage}`;
        if (searchTerm) {
          endpoint += `&search=${encodeURIComponent(searchTerm)}`;
        }
        
        const response = await apiCall(endpoint, {}, logs, setLogs);
        setData(prev => ({
          ...prev,
          vcenterVMs: response.vms || [],
          vcenterTotalCount: response.total_count || 0
        }));
      } else {
        endpoint = `/api/v1/get-all-jira-vms-from-db?skip=${skip}&limit=${itemsPerPage}`;
        
        const response = await apiCall(endpoint, {}, logs, setLogs);
        setData(prev => ({
          ...prev,
          jiraVMs: response.vms || [],
          jiraTotalCount: response.total_count || 0
        }));
      }
      
      addLog(`Loaded ${vmDataSource === 'vcenter' ? 'vCenter' : 'Jira'} VMs successfully`, 'success', logs, setLogs);
    } catch (error) {
      addLog(`Failed to load ${vmDataSource === 'vcenter' ? 'vCenter' : 'Jira'} VMs`, 'error', logs, setLogs);
    } finally {
      setLoadingState('vms', false);
    }
  };

  // Collect vCenter VMs with configuration
  const collectVCenterVMs = async () => {
    setLoadingState('vcenter', true);
    
    // ✅ YENİ - Enhanced log message
    let logMessage = 'Starting vCenter VM collection...';
    if (config.vcenter.default_site || config.vcenter.default_zone) {
      const defaults = [];
      if (config.vcenter.default_site) defaults.push(`Site: ${config.vcenter.default_site}`);
      if (config.vcenter.default_zone) defaults.push(`Zone: ${config.vcenter.default_zone}`);
      logMessage += ` (Default tags: ${defaults.join(', ')})`;
    }
    addLog(logMessage, 'info', logs, setLogs);
    
    try {
      // ✅ YENİ - Enhanced request payload with default Site/Zone
      const requestPayload = {
        vcenter_config: {
          host: config.vcenter.host,
          username: config.vcenter.username,
          password: config.vcenter.password,
          port: config.vcenter.port,
          // ✅ YENİ - Default Site və Zone dəyərləri əlavə et
          default_site: config.vcenter.default_site || null,
          default_zone: config.vcenter.default_zone || null
        },
        batch_size: 50,
        max_processes: 8
      };

      // ✅ YENİ - Debug log for payload
      if (config.vcenter.default_site || config.vcenter.default_zone) {
        addLog(`Configured defaults will be applied to VMs without tags`, 'info', logs, setLogs);
      }

      const response = await apiCall('/api/v1/collect-vms', {
        method: 'POST',
        body: JSON.stringify(requestPayload)
      }, logs, setLogs);
      
      // ✅ YENİ - Enhanced success message
      let successMessage = `vCenter collection completed: ${response.processed_vms} VMs processed`;
      if (response.default_applied && response.default_applied > 0) {
        successMessage += `, ${response.default_applied} VMs received default Site/Zone tags`;
      }
      
      addLog(successMessage, 'success', logs, setLogs);
      loadDashboardData();
    } catch (error) {
      addLog('vCenter collection failed', 'error', logs, setLogs);
    } finally {
      setLoadingState('vcenter', false);
    }
  };


  // Collect Jira VMs with configuration
  const collectJiraVMs = async () => {
    if (!isConfigComplete()) {
      addLog('Configuration incomplete. Please configure Jira settings first.', 'error', logs, setLogs);
      setShowConfigModal(true);
      return;
    }

    setLoadingState('jira', true);
    addLog('Starting Jira VM collection...', 'info', logs, setLogs);
    
    try {
      const apiConfig = getApiConfig();
      const response = await apiCall('/api/v1/collect-jira-vms', {
        method: 'POST',
        body: JSON.stringify({
          jira_config: apiConfig.jira_config,
          batch_size: 50,
          max_processes: 8
        })
      }, logs, setLogs);
      
      addLog(`Jira collection completed: ${response.processed_vms} VMs processed`, 'success', logs, setLogs);
      loadDashboardData();
    } catch (error) {
      addLog('Jira collection failed', 'error', logs, setLogs);
    } finally {
      setLoadingState('jira', false);
    }
  };

  const collectVCenterVMsAsync = async () => {
    setLoadingState('vcenterAsync', true);
    
    let logMessage = 'Starting vCenter VM collection (async)...';
    if (config.vcenter.default_site || config.vcenter.default_zone) {
      const defaults = [];
      if (config.vcenter.default_site) defaults.push(`Site: ${config.vcenter.default_site}`);
      if (config.vcenter.default_zone) defaults.push(`Zone: ${config.vcenter.default_zone}`);
      logMessage += ` (Default tags: ${defaults.join(', ')})`;
    }
    addLog(logMessage, 'info', logs, setLogs);
    
    try {
      const requestPayload = {
        vcenter_config: {
          host: config.vcenter.host,
          username: config.vcenter.username,
          password: config.vcenter.password,
          port: config.vcenter.port,
          default_site: config.vcenter.default_site || null,
          default_zone: config.vcenter.default_zone || null
        },
        batch_size: 50,
        max_processes: 8
      };

      const response = await apiCall('/api/v1/collect-vms-async', {
        method: 'POST',
        body: JSON.stringify(requestPayload)
      }, logs, setLogs);
      
      let asyncMessage = response.message;
      if (config.vcenter.default_site || config.vcenter.default_zone) {
        asyncMessage += ' Default Site/Zone tags will be applied where needed.';
      }
      
      addLog(asyncMessage, 'success', logs, setLogs);
    } catch (error) {
      addLog('vCenter async collection failed', 'error', logs, setLogs);
    } finally {
      setLoadingState('vcenterAsync', false);
    }
  };

  // Process VM Diff with configuration
  const processVMDiff = async () => {
    if (!isConfigComplete()) {
      addLog('Configuration incomplete. Please configure Jira settings first.', 'error', logs, setLogs);
      setShowConfigModal(true);
      return;
    }

    setLoadingState('diff', true);
    addLog('Starting VM diff processing (IP-only matching)...', 'info', logs, setLogs);
    
    try {
      const apiConfig = getApiConfig();
      const response = await apiCall('/api/v1/process-vm-diff', {
        method: 'POST',
        body: JSON.stringify({
          jira_config: apiConfig.jira_config
        })
      }, logs, setLogs);
      
      addLog(`Diff processing completed: ${response.missing_vms_count} missing VMs found`, 'success', logs, setLogs);
      loadDashboardData();
    } catch (error) {
      addLog('VM diff processing failed', 'error', logs, setLogs);
    } finally {
      setLoadingState('diff', false);
    }
  };

  // Post to Jira with configuration
  const postToJira = async () => {
    if (!isConfigComplete()) {
      addLog('Configuration incomplete. Please configure Jira settings first.', 'error', logs, setLogs);
      setShowConfigModal(true);
      return;
    }

    setLoadingState('jiraPost', true);
    addLog('Starting Jira Asset posting...', 'info', logs, setLogs);
    
    try {
      const apiConfig = getApiConfig();
      const response = await apiCall('/api/v1/post-to-jira', {
        method: 'POST',
        body: JSON.stringify({
          jira_config: {
            jira_token: apiConfig.jira_config.token,
            create_url: apiConfig.jira_config.create_url,
            object_type_id: config.jira.object_type_id,
            object_schema_id: config.jira.object_schema_id,
            delay_seconds: 1.0
          },
          limit: 10,
          retry_failed: false
        })
      }, logs, setLogs);
      
      addLog(`Jira posting completed: ${response.successful} successful, ${response.failed} failed`, 
             response.failed > 0 ? 'warning' : 'success', logs, setLogs);
      loadDashboardData();
    } catch (error) {
      addLog('Jira posting failed', 'error', logs, setLogs);
    } finally {
      setLoadingState('jiraPost', false);
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

  // Sort handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Show VM details modal with enhanced data
  const showVMDetails = (vm, source) => {
    setSelectedVM({...vm, source});
    setShowVMModal(true);
  };

  // Page change handler
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Items per page change handler
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(parseInt(newItemsPerPage));
    setCurrentPage(1);
  };

  // Enhanced load missing VMs function with pagination fix
  const loadMissingVMs = async () => {
    setLoadingState('missingVMs', true);
    try {
      const skip = (currentPage - 1) * itemsPerPage;
      const response = await apiCall(`/api/v1/get-missing-vms-with-selection?skip=${skip}&limit=${itemsPerPage}`, {}, logs, setLogs);
      
      let filteredVMs = response.vms || [];
      
      // Apply client-side filtering
      if (searchTerm) {
        filteredVMs = filteredVMs.filter(vm => {
          const vmName = vm.vm_name?.toLowerCase() || '';
          const vmIP = vm.vm_summary?.ip?.toLowerCase() || '';
          const search = searchTerm.toLowerCase();
          return vmName.includes(search) || vmIP.includes(search);
        });
      }
      
      if (statusFilter !== 'all') {
        filteredVMs = filteredVMs.filter(vm => vm.status === statusFilter);
      }
      
      // Apply sorting
      filteredVMs.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        if (sortField === 'created_date') {
          aVal = new Date(aVal || 0);
          bVal = new Date(bVal || 0);
        } else if (typeof aVal === 'string') {
          aVal = (aVal || '').toLowerCase();
          bVal = (bVal || '').toLowerCase();
        }
        
        if (sortDirection === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });
      
      setData(prev => ({
        ...prev,
        missingVMs: filteredVMs,
        totalMissingCount: response.total_count || 0
      }));
      
      addLog(`Loaded ${filteredVMs.length} missing VMs`, 'success', logs, setLogs);
      
      // Reset selections when data changes
      setSelectedVMIds(new Set());
      setSelectAll(false);
      
    } catch (error) {
      addLog('Failed to load missing VMs', 'error', logs, setLogs);
    } finally {
      setLoadingState('missingVMs', false);
    }
  };

  // Enhanced VM selection handlers
  const handleVMSelection = (vmId, isSelected) => {
    const newSelected = new Set(selectedVMIds);
    if (isSelected) {
      newSelected.add(vmId);
    } else {
      newSelected.delete(vmId);
    }
    setSelectedVMIds(newSelected);
    
    // Update select all state
    const selectableVMs = data.missingVMs.filter(vm => vm.status === 'pending_creation');
    setSelectAll(newSelected.size === selectableVMs.length && selectableVMs.length > 0);
  };

  const handleSelectAll = (isSelected) => {
    const selectableVMs = data.missingVMs.filter(vm => vm.status === 'pending_creation');
    
    if (isSelected) {
      const allIds = new Set(selectableVMs.map(vm => vm.id));
      setSelectedVMIds(allIds);
    } else {
      setSelectedVMIds(new Set());
    }
    setSelectAll(isSelected);
  };

  // Enhanced posting function with configuration
  const postSelectedVMsToJira = async () => {
    if (selectedVMIds.size === 0) {
      addLog('No VMs selected for posting', 'warning', logs, setLogs);
      return;
    }

    if (!isConfigComplete()) {
      addLog('Configuration incomplete. Please configure Jira settings first.', 'error', logs, setLogs);
      setShowConfigModal(true);
      return;
    }

    setLoadingState('selectedJiraPost', true);
    addLog(`Starting Jira Asset posting for ${selectedVMIds.size} selected VMs...`, 'info', logs, setLogs);
    
    try {
      const apiConfig = getApiConfig();
      const response = await apiCall('/api/v1/post-selected-vms-to-jira', {
        method: 'POST',
        body: JSON.stringify({
          jira_config: {
            jira_token: apiConfig.jira_config.token,
            create_url: apiConfig.jira_config.create_url,
            object_type_id: config.jira.object_type_id,
            object_schema_id: config.jira.object_schema_id,
            delay_seconds: 1.0
          },
          vm_ids: Array.from(selectedVMIds),
          delay_seconds: 1.0
        })
      }, logs, setLogs);
      
      addLog(`Selected VMs posting completed: ${response.successful} successful, ${response.failed} failed`, 
            response.failed > 0 ? 'warning' : 'success', logs, setLogs);
      
      // Show detailed results
      if (response.results && response.results.length > 0) {
        response.results.forEach(result => {
          if (result.status === 'success') {
            addLog(`✅ ${result.vm_name} created as ${result.object_key}`, 'success', logs, setLogs);
          } else {
            addLog(`❌ ${result.vm_name} failed: ${result.error}`, 'error', logs, setLogs);
          }
        });
      }
      
      // Refresh data and reset selections
      await loadMissingVMs();
      setShowPostingModal(false);
      
    } catch (error) {
      addLog('Selected VMs Jira posting failed', 'error', logs, setLogs);
    } finally {
      setLoadingState('selectedJiraPost', false);
    }
  };

  // Load completed assets
  const loadCompletedAssets = async () => {
    try {
      const response = await apiCall('/api/v1/completed-jira-assets?limit=50', {}, logs, setLogs);
      setData(prev => ({...prev, completedAssets: response.assets || []}));
    } catch (error) {
      addLog('Failed to load completed assets', 'error', logs, setLogs);
    }
  };

  // Load failed assets
  const loadFailedAssets = async () => {
    try {
      const response = await apiCall('/api/v1/failed-jira-assets?limit=50', {}, logs, setLogs);
      setData(prev => ({...prev, failedAssets: response.assets || []}));
    } catch (error) {
      addLog('Failed to load failed assets', 'error', logs, setLogs);
    }
  };

  // Initial load
  useEffect(() => {
    if (isConfigLoaded) {
      loadDashboardData();
    }
  }, [isConfigLoaded]);

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

  // Apply filters/search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'missing-vms') {
        setCurrentPage(1);
        loadMissingVMs();
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, sortField, sortDirection]);

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
            <div className="flex items-center gap-3">
              {/* Configuration Status Indicator */}
              {!isConfigComplete() && (
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-100 text-orange-800 rounded-lg text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  Configuration Required
                </div>
              )}
              
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
                className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                  !isConfigComplete() 
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
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
          <DashboardTab data={data} />
        )}

        {/* Operations Tab */}
        {activeTab === 'operations' && (
          <OperationsTab 
            data={data}
            loading={loading}
            collectVCenterVMs={collectVCenterVMs}
            collectJiraVMs={collectJiraVMs}
            processVMDiff={processVMDiff}
            postToJira={postToJira}
            isConfigComplete={isConfigComplete}
            onConfigClick={() => setShowConfigModal(true)}
            config={config} 
          />
        )}

        {/* VM Summary Tab */}
        {activeTab === 'vm-summary' && (
          <VMSummaryTab
            vmDataSource={vmDataSource}
            setVmDataSource={setVmDataSource}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            powerStateFilter={powerStateFilter}
            setPowerStateFilter={setPowerStateFilter}
            loading={loading}
            loadVMs={loadVMs}
            data={data}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            sortField={sortField}
            sortDirection={sortDirection}
            handleSort={handleSort}
            handlePageChange={handlePageChange}
            handleItemsPerPageChange={handleItemsPerPageChange}
            showVMDetails={showVMDetails}
            getCurrentVMs={getCurrentVMs}
            getTotalCount={getTotalCount}
          />
        )}

        {/* Missing VMs Tab */}
        {activeTab === 'missing-vms' && (
          <MissingVMsTab
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            itemsPerPage={itemsPerPage}
            handleItemsPerPageChange={handleItemsPerPageChange}
            loading={loading}
            loadMissingVMs={loadMissingVMs}
            selectedVMIds={selectedVMIds}
            selectAll={selectAll}
            handleSelectAll={handleSelectAll}
            handleVMSelection={handleVMSelection}
            setShowPostingModal={setShowPostingModal}
            data={data}
            sortField={sortField}
            sortDirection={sortDirection}
            handleSort={handleSort}
            showVMDetails={showVMDetails}
            currentPage={currentPage}
            handlePageChange={handlePageChange}
            setSelectedVMIds={setSelectedVMIds}
            setSelectAll={setSelectAll}
          />
        )}

        {/* Jira Assets Tab */}
        {activeTab === 'jira-assets' && (
          <JiraAssetsTab data={data} />
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <LogsTab logs={logs} setLogs={setLogs} />
        )}
      </main>

      {/* Modals */}
      <EnhancedVMDetailsModal
        selectedVM={selectedVM}
        showVMModal={showVMModal}
        setShowVMModal={setShowVMModal}
      />

      <ConfigModal
        showConfigModal={showConfigModal}
        setShowConfigModal={setShowConfigModal}
        config={config}
        setConfig={setConfig}
        addLog={(message, type) => addLog(message, type, logs, setLogs)}
      />

      <PostingModal
        showPostingModal={showPostingModal}
        setShowPostingModal={setShowPostingModal}
        selectedVMIds={selectedVMIds}
        loading={loading}
        postSelectedVMsToJira={postSelectedVMsToJira}
      />
    </div>
  );
};

export default VMwareCollectorApp;
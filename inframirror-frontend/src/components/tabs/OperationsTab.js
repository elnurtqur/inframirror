import React from 'react';
import { 
  Activity, 
  Clock, 
  Server, 
  Database, 
  HardDrive, 
  CheckCircle, 
  AlertCircle,
  Tag
} from 'lucide-react';
import LoadingButton from '../common/LoadingButton';

const OperationsTab = ({ 
  data, 
  loading, 
  collectVCenterVMs, 
  collectJiraVMs, 
  processVMDiff, 
  postToJira,
  config  // ✅ YENİ - Config prop əlavə et
}) => {
  // ✅ YENİ - Default tag helper
  const getDefaultTagsDisplay = () => {
    const defaults = [];
    if (config?.vcenter?.default_site) defaults.push(`Site: ${config.vcenter.default_site}`);
    if (config?.vcenter?.default_zone) defaults.push(`Zone: ${config.vcenter.default_zone}`);
    return defaults.length > 0 ? defaults.join(', ') : 'None configured';
  };

  const hasDefaults = config?.vcenter?.default_site || config?.vcenter?.default_zone;

  return (
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

        {/* ✅ YENİ - Default Tags Display Panel */}
        {hasDefaults && (
          <div className="mt-4 bg-blue-100 border border-blue-300 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-5 h-5 text-blue-600" />
              <h3 className="font-medium text-blue-900">Default Tags Configuration</h3>
            </div>
            <p className="text-sm text-blue-800">
              <strong>Active defaults:</strong> {getDefaultTagsDisplay()}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              These values will be applied to VMs that don't have Site or Zone tags in vCenter
            </p>
          </div>
        )}
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
          {/* Step 1: Collect vCenter VMs - Enhanced */}
          <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Server className="w-5 h-5 text-blue-600" />
                Collect vCenter VMs
                {/* ✅ YENİ - Enhanced indicator */}
                {hasDefaults && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-200 text-blue-800">
                    <Tag className="w-3 h-3 mr-1" />
                    Default Tags
                  </span>
                )}
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Connect to vCenter server and collect all virtual machine information including hardware specs, network details, and tags.
                {/* ✅ YENİ - Enhanced description */}
                {hasDefaults && (
                  <span className="block mt-1 text-blue-700 font-medium">
                    🏷️ Default tags will be applied: {getDefaultTagsDisplay()}
                  </span>
                )}
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
                {/* ✅ YENİ - Default tags indicator */}
                {hasDefaults && (
                  <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                    🏷️ With default tags
                  </div>
                )}
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

          {/* Step 2: Collect Jira VMs (unchanged) */}
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

          {/* Step 3: Process VM Diff - Enhanced */}
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
                {/* ✅ YENİ - Enhanced description for default tags */}
                {hasDefaults && (
                  <span className="block mt-1 text-orange-700 font-medium">
                    🏷️ Missing VMs will include default Site/Zone tags in Jira payloads
                  </span>
                )}
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

          {/* Step 4: Post to Jira - Enhanced */}
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
                {/* ✅ YENİ - Enhanced description for default tags */}
                {hasDefaults && (
                  <span className="block mt-1 text-purple-700 font-medium">
                    🏷️ VMs with default tags will be created with proper Site/Zone values
                  </span>
                )}
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

        {/* ✅ YENİ - Default Tags Information Panel */}
        {!hasDefaults && (
          <div className="px-6 pb-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="w-5 h-5 text-gray-500" />
                <h3 className="font-medium text-gray-700">No Default Tags Configured</h3>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                You can set default Site and Zone values in Configuration for VMs that don't have these tags in vCenter.
              </p>
              <p className="text-xs text-gray-500">
                💡 Go to Configuration → VMware vCenter → Default VM Tags to set up default values
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationsTab;
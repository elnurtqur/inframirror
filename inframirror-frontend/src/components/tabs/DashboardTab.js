import React from 'react';
import { Server, Database, AlertCircle, Activity, Power, PowerOff, Pause } from 'lucide-react';
import StatCard from '../common/StatCard';
import PowerStateCard from '../common/PowerStateCard';

const DashboardTab = ({ data }) => {
  // Success rate hesablama
  const calculateSuccessRate = () => {
    if (!data.vcenterStats?.total_vms || !data.collectionStatus?.missing_vms_count) {
      return 'N/A';
    }
    const rate = (1 - data.collectionStatus.missing_vms_count / data.vcenterStats.total_vms) * 100;
    return `${Math.round(rate)}%`;
  };

  return (
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
          title="Sync Rate"
          value={calculateSuccessRate()}
          icon={Activity}
          color="purple"
        />
      </div>

      {/* Power State Distribution */}
      {data.vcenterStats?.power_state_distribution && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-6">
            <Activity className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-semibold">vCenter VM Power States</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PowerStateCard
              state="powered on"
              count={data.vcenterStats.power_state_distribution.poweredOn}
              icon={Power}
              color="green"
              totalVMs={data.vcenterStats.total_vms}
            />
            <PowerStateCard
              state="powered off"
              count={data.vcenterStats.power_state_distribution.poweredOff}
              icon={PowerOff}
              color="red"
              totalVMs={data.vcenterStats.total_vms}
            />
            <PowerStateCard
              state="suspended"
              count={data.vcenterStats.power_state_distribution.suspended}
              icon={Pause}
              color="yellow"
              totalVMs={data.vcenterStats.total_vms}
            />
          </div>
        </div>
      )}

      {/* System Overview */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-6">
          <Database className="w-6 h-6 text-green-600 mr-2" />
          <h3 className="text-lg font-semibold">System Integration Overview</h3>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* vCenter Integration */}
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center mb-4">
              <Server className="w-5 h-5 text-blue-600 mr-2" />
              <h4 className="font-medium text-blue-900">vCenter Integration</h4>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Total VMs:</span>
                <span className="font-medium text-blue-900">{data.vcenterStats?.total_vms || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Active VMs:</span>
                <span className="font-medium text-blue-900">
                  {data.vcenterStats?.power_state_distribution?.poweredOn || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">With VMID:</span>
                <span className="font-medium text-blue-900">
                  {data.vcenterStats?.total_vms || 0} <span className="text-xs text-blue-600">(Auto-generated)</span>
                </span>
              </div>
              <div className="pt-2 border-t border-blue-200">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Status:</span>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    Connected
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Jira Integration */}
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <div className="flex items-center mb-4">
              <Database className="w-5 h-5 text-green-600 mr-2" />
              <h4 className="font-medium text-green-900">Jira Asset Management</h4>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Asset VMs:</span>
                <span className="font-medium text-green-900">{data.jiraStats?.total_jira_vms || 0}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Missing VMs:</span>
                <span className="font-medium text-orange-600">
                  {data.collectionStatus?.missing_vms_count || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Match Rate:</span>
                <span className="font-medium text-green-900">{calculateSuccessRate()}</span>
              </div>
              <div className="pt-2 border-t border-green-200">
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">Status:</span>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    Synchronized
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {(data.vcenterStats || data.jiraStats || data.collectionStatus) && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-6 h-6 text-orange-600 mr-2" />
            <h3 className="text-lg font-semibold">System Status</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {data.vcenterStats?.total_vms || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">vCenter VMs</div>
              <div className="text-xs text-gray-500 mt-2">
                Including VMID data
              </div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {data.jiraStats?.total_jira_vms || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Jira Assets</div>
              <div className="text-xs text-gray-500 mt-2">
                Managed assets
              </div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {data.collectionStatus?.missing_vms_count || 0}
              </div>
              <div className="text-sm text-gray-600 mt-1">Missing VMs</div>
              <div className="text-xs text-gray-500 mt-2">
                Ready for creation
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardTab;

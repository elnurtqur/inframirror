import React from 'react';
import { Server, Database, AlertCircle, Activity, Power, PowerOff, Pause } from 'lucide-react';
import StatCard from '../common/StatCard';
import PowerStateCard from '../common/PowerStateCard';

const DashboardTab = ({ data }) => {
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
    </div>
  );
};

export default DashboardTab;
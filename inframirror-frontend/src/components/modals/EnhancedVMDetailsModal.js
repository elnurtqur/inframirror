import React, { useState } from 'react';
import { X, Copy, Check, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

const EnhancedVMDetailsModal = ({ selectedVM, showVMModal, setShowVMModal }) => {
  const [copiedField, setCopiedField] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    hardware: true,
    network: true,
    storage: true,
    tags: true,
    infrastructure: false,
    management: false,
    rawJson: false
  });

  if (!showVMModal || !selectedVM) return null;

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(''), 2000);
    });
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const isVCenter = selectedVM.source === 'vcenter';
  const isJira = selectedVM.source === 'jira';
  const isMissing = selectedVM.source === 'missing';

  const formatValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return value.toString();
  };

  const CopyableField = ({ label, value, fieldKey }) => (
    <div className="flex justify-between items-start py-2 border-b border-gray-100">
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-600">{label}:</span>
        <div className="mt-1">
          <span className="text-sm text-gray-900 break-all">{formatValue(value)}</span>
        </div>
      </div>
      <button
        onClick={() => copyToClipboard(formatValue(value), fieldKey)}
        className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
        title="Copy to clipboard"
      >
        {copiedField === fieldKey ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Copy className="w-4 h-4 text-gray-400" />
        )}
      </button>
    </div>
  );

  const SectionHeader = ({ title, section, count = null }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 hover:bg-gray-100 transition-colors rounded-lg mb-3"
    >
      <div className="flex items-center space-x-2">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        {count !== null && (
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
            {count}
          </span>
        )}
      </div>
      {expandedSections[section] ? (
        <ChevronDown className="w-5 h-5 text-gray-600" />
      ) : (
        <ChevronRight className="w-5 h-5 text-gray-600" />
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {isVCenter ? 'vCenter' : isJira ? 'Jira Asset' : isMissing ? 'Missing VM' : 'VM'} Details
              </h3>
              <p className="text-lg text-gray-700 mt-1">
                {selectedVM.name || selectedVM.vm_name || 'Unknown VM'}
              </p>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  isVCenter ? 'bg-blue-100 text-blue-800' : 
                  isJira ? 'bg-green-100 text-green-800' :
                  isMissing ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {isVCenter ? 'vCenter VM' : isJira ? 'Jira Asset' : isMissing ? 'Missing VM' : 'VM'}
                </span>
                {isVCenter && selectedVM.power_state && (
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    selectedVM.power_state === 'poweredOn' 
                      ? 'bg-green-100 text-green-800'
                      : selectedVM.power_state === 'poweredOff'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedVM.power_state}
                  </span>
                )}
                {isMissing && selectedVM.status && (
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    selectedVM.status === 'pending_creation' 
                      ? 'bg-yellow-100 text-yellow-800'
                      : selectedVM.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedVM.status?.replace('_', ' ') || 'Unknown'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowVMModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <SectionHeader title="Basic Information" section="basic" />
            {expandedSections.basic && (
              <div className="space-y-2">
                <CopyableField label="Name" value={selectedVM.name || selectedVM.vm_name} fieldKey="name" />
                {isVCenter && (
                  <>
                    <CopyableField label="UUID" value={selectedVM.uuid} fieldKey="uuid" />
                    <CopyableField label="Instance UUID" value={selectedVM.instance_uuid} fieldKey="instance_uuid" />
                    <CopyableField label="MobID" value={selectedVM.mobid} fieldKey="mobid" />
                    <CopyableField label="Guest OS" value={selectedVM.guest_os || selectedVM.guest_os_full_name} fieldKey="guest_os" />
                    <CopyableField label="VM Version" value={selectedVM.vm_version} fieldKey="vm_version" />
                    <CopyableField label="Tools Status" value={selectedVM.tools_status} fieldKey="tools_status" />
                    <CopyableField label="Tools Version" value={selectedVM.tools_version} fieldKey="tools_version" />
                    <CopyableField label="Guest Hostname" value={selectedVM.guest_hostname} fieldKey="guest_hostname" />
                    <CopyableField label="Guest State" value={selectedVM.guest_state} fieldKey="guest_state" />
                  </>
                )}
                {isJira && (
                  <>
                    <CopyableField label="Jira Key" value={selectedVM.jira_object_key} fieldKey="jira_object_key" />
                    <CopyableField label="Jira ID" value={selectedVM.jira_object_id} fieldKey="jira_object_id" />
                    <CopyableField label="DNS Name" value={selectedVM.dns_name} fieldKey="dns_name" />
                    <CopyableField label="Operating System" value={selectedVM.operating_system} fieldKey="operating_system" />
                    {/* <CopyableField label="Platform" value={selectedVM.platform} fieldKey="platform" />
                    <CopyableField label="Site" value={selectedVM.site} fieldKey="site" />
                    <CopyableField label="Environment" value={selectedVM.Environment} fieldKey="environment" />
                    <CopyableField label="Zone" value={selectedVM.Zone} fieldKey="zone" />
                    <CopyableField label="Description" value={selectedVM.description} fieldKey="description" />
                    <CopyableField label="Created By" value={selectedVM.created_by || selectedVM.CreatedBY} fieldKey="created_by" /> */}
                  </>
                )}
                {isMissing && selectedVM.vm_summary && (
                  <>
                    <CopyableField label="Site" value={selectedVM.vm_summary.site} fieldKey="missing_site" />
                    <CopyableField label="Zone" value={selectedVM.vm_summary.zone} fieldKey="missing_zone" />
                    <CopyableField label="Environment" value={selectedVM.vm_summary.environment} fieldKey="missing_environment" />
                  </>
                )}
                <CopyableField label="Annotation" value={selectedVM.annotation} fieldKey="annotation" />
                <CopyableField label="Created Date" value={selectedVM.created_date} fieldKey="created_date" />
                <CopyableField label="Last Updated" value={selectedVM.last_updated} fieldKey="last_updated" />
              </div>
            )}
          </div>

          {/* Hardware Information */}
          <div>
            <SectionHeader title="Hardware Information" section="hardware" />
            {expandedSections.hardware && (
              <div className="space-y-2">
                <CopyableField label="CPU Count" value={selectedVM.cpu_count || (selectedVM.vm_summary && selectedVM.vm_summary.cpu)} fieldKey="cpu_count" />
                {isVCenter && (
                  <CopyableField label="CPU Cores per Socket" value={selectedVM.cpu_cores_per_socket} fieldKey="cpu_cores_per_socket" />
                )}
                <CopyableField label="Memory (GB)" value={selectedVM.memory_gb || (selectedVM.vm_summary && selectedVM.vm_summary.memory)} fieldKey="memory_gb" />
                <CopyableField label="Memory (MB)" value={selectedVM.memory_mb} fieldKey="memory_mb" />
                <CopyableField label="Disk (GB)" value={selectedVM.disk_gb || (selectedVM.vm_summary && selectedVM.vm_summary.disk)} fieldKey="disk_gb" />
              </div>
            )}
          </div>

          {/* Network Information */}
          <div>
            <SectionHeader title="Network Information" section="network" />
            {expandedSections.network && (
              <div className="space-y-2">
                <CopyableField label="Primary IP Address" value={selectedVM.ip_address || (selectedVM.vm_summary && selectedVM.vm_summary.ip)} fieldKey="ip_address" />
                {isJira && (
                  <>
                    <CopyableField label="Secondary IP" value={selectedVM.secondary_ip} fieldKey="secondary_ip" />
                    <CopyableField label="Secondary IP 2" value={selectedVM.secondary_ip2} fieldKey="secondary_ip2" />
                  </>
                )}
                {isVCenter && selectedVM.guest_ip_addresses && selectedVM.guest_ip_addresses.length > 0 && (
                  <div className="py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Guest IP Addresses:</span>
                    <div className="mt-1 space-y-1">
                      {selectedVM.guest_ip_addresses.map((ip, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <span className="text-sm text-gray-900">{ip}</span>
                          <button
                            onClick={() => copyToClipboard(ip, `guest_ip_${index}`)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                          >
                            {copiedField === `guest_ip_${index}` ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isVCenter && selectedVM.networks && selectedVM.networks.length > 0 && (
                  <div className="py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-600">Network Adapters:</span>
                    <div className="mt-1 space-y-2">
                      {selectedVM.networks.map((network, index) => (
                        <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                          <div><strong>Label:</strong> {network.label}</div>
                          <div><strong>MAC:</strong> {network.mac_address}</div>
                          <div><strong>Connected:</strong> {network.connected ? 'Yes' : 'No'}</div>
                          <div><strong>Network:</strong> {network.network_name || 'N/A'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Storage Information */}
          {isVCenter && selectedVM.disks && selectedVM.disks.length > 0 && (
            <div>
              <SectionHeader title="Storage Information" section="storage" count={selectedVM.disks.length} />
              {expandedSections.storage && (
                <div className="space-y-3">
                  {selectedVM.disks.map((disk, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <div className="font-medium text-gray-900 mb-2">{disk.label}</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><strong>Capacity:</strong> {disk.capacity_gb} GB</div>
                        <div><strong>Mode:</strong> {disk.disk_mode || 'N/A'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Infrastructure Information */}
          <div>
            <SectionHeader title="Infrastructure" section="infrastructure" />
            {expandedSections.infrastructure && (
              <div className="space-y-2">
                <CopyableField label="Resource Pool" value={selectedVM.resource_pool} fieldKey="resource_pool" />
                {isVCenter && (
                  <>
                    <CopyableField label="Host Name" value={selectedVM.host_name} fieldKey="host_name" />
                    <CopyableField label="Folder" value={selectedVM.folder_name} fieldKey="folder_name" />
                    {selectedVM.datastores && selectedVM.datastores.length > 0 && (
                      <div className="py-2 border-b border-gray-100">
                        <span className="text-sm font-medium text-gray-600">Datastores:</span>
                        <div className="mt-1 space-y-2">
                          {selectedVM.datastores.map((ds, index) => (
                            <div key={index} className="bg-gray-50 p-2 rounded text-sm">
                              <div><strong>Name:</strong> {ds.name}</div>
                              <div><strong>Type:</strong> {ds.type}</div>
                              <div><strong>Capacity:</strong> {ds.capacity_gb} GB</div>
                              <div><strong>Free Space:</strong> {ds.free_space_gb} GB</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {isJira && (
                  <>
                    <CopyableField label="Datastore" value={selectedVM.datastore} fieldKey="datastore" />
                    <CopyableField label="ESXi Cluster" value={selectedVM.esxi_cluster} fieldKey="esxi_cluster" />
                    <CopyableField label="ESXi Host" value={selectedVM.esxi_host} fieldKey="esxi_host" />
                    <CopyableField label="ESXi Port Group" value={selectedVM.esxi_port_group} fieldKey="esxi_port_group" />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          {(selectedVM.tags || selectedVM.tags_jira_asset) && (
            <div>
              <SectionHeader title="Tags" section="tags" />
              {expandedSections.tags && (
                <div className="space-y-4">

                  {selectedVM.tags_jira_asset && selectedVM.tags_jira_asset.length > 0 && (
                    <div>
                      
                      {selectedVM.tags_jira_asset.map((tagGroup, index) => (
                        <div key={index} className="bg-green-50 p-3 rounded-lg">
                          {Object.entries(tagGroup).map(([key, value]) => (
                            <div key={key} className="flex justify-between items-center py-1">
                              <span className="text-sm font-medium text-green-900">{key}:</span>
                              <span className="text-sm text-green-800">{value}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


          {/* Missing VM specific data */}
          {isMissing && selectedVM.jira_asset_payload && (
            <div>
              <SectionHeader title="Jira Asset Payload" section="payload" />
              {expandedSections.payload && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Generated Payload for Jira</span>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(selectedVM.jira_asset_payload, null, 2), 'payload')}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                      {copiedField === 'payload' ? 'Copied!' : 'Copy Payload'}
                    </button>
                  </div>
                  <pre className="text-xs overflow-auto max-h-64 bg-white p-2 rounded border">
                    {JSON.stringify(selectedVM.jira_asset_payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Debug Info */}
          {selectedVM.debug_info && (
            <div>
              <SectionHeader title="Debug Information" section="debug" />
              {expandedSections.debug && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="space-y-2 text-sm">
                    {Object.entries(selectedVM.debug_info).map(([key, value]) => (
                      <CopyableField key={key} label={key} value={value} fieldKey={`debug_${key}`} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Raw JSON */}
          <div>
            <SectionHeader title="Raw JSON Data" section="rawJson" />
            {expandedSections.rawJson && (
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Complete VM Data</span>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedVM, null, 2), 'raw_json')}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                  >
                    {copiedField === 'raw_json' ? 'Copied!' : 'Copy JSON'}
                  </button>
                </div>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(selectedVM, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Data Source: {selectedVM.data_source || (isVCenter ? 'vCenter' : isJira ? 'Jira Asset Management' : 'Missing VM Processor')}
            </div>
            <button
              onClick={() => setShowVMModal(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedVMDetailsModal;
"""
Enhanced VM diff processing service - IP-ONLY based matching
Finds VMs that exist in vCenter but not in Jira using ONLY IP address comparison
"""

import time
import logging
import ipaddress
from datetime import datetime
from typing import Dict, Set, Any, Optional

from pymongo import UpdateOne
from pymongo.errors import BulkWriteError

from app.services.jira_service import JiraService
from app.core.database import get_sync_collection
from app.core.config import settings

logger = logging.getLogger(__name__)


class DiffService:
    """IP-only VM diff processing service"""
    
    def __init__(self):
        self.jira_service = JiraService()
        self.vcenter_collection = None
        self.jira_collection = None
        self.missing_collection = None
    
    def get_collections(self):
        """Get MongoDB collections"""
        if self.vcenter_collection is None:
            self.vcenter_collection = get_sync_collection()  # virtual_machines
        if self.jira_collection is None:
            # Get Jira collection 
            client = self.vcenter_collection.database.client
            db = client[settings.mongodb_database]
            self.jira_collection = db['jira_virtual_machines']
        if self.missing_collection is None:
            # Get Missing VMs collection
            client = self.vcenter_collection.database.client
            db = client[settings.mongodb_database]
            self.missing_collection = db['missing_vms_for_jira']
    
    def is_valid_ip(self, ip: str) -> bool:
        """Validate IP address format and exclude invalid ranges"""
        try:
            if not ip or not isinstance(ip, str):
                return False
            
            ip = ip.strip()
            if not ip:
                return False
                
            # Parse IP address
            ip_obj = ipaddress.ip_address(ip)
            
            # Skip invalid/local IPs
            invalid_ranges = [
                '127.',      # Loopback
                '0.0.0.0',   # Invalid
                '255.255.255.255',  # Broadcast
                '169.254.',  # Link-local
            ]
            
            for invalid in invalid_ranges:
                if ip.startswith(invalid):
                    return False
                    
            return True
            
        except (ValueError, TypeError):
            return False
    
    def get_vcenter_vms_by_ip(self) -> Dict[str, Dict[str, Any]]:
            """Get vCenter VMs indexed BY IP ADDRESS ONLY - FIXED VERSION"""
            try:
                self.get_collections()
                
                vms_by_ip = {}        # IP address -> VM data  
                all_vms = []          # All VM data for processing
                
                # Get VM data with all relevant fields
                cursor = self.vcenter_collection.find({}, {
                    'name': 1, 'uuid': 1, 'ip_address': 1, 'guest_ip_addresses': 1,
                    'cpu_count': 1, 'memory_gb': 1, 'resource_pool': 1, 'annotation': 1,
                    'guest_os': 1, 'tags': 1, 'tags_jira_asset': 1, 'disks': 1, 
                    'created_date': 1, 'mobid': 1, 'networks': 1
                })
                
                for vm in cursor:
                    # SAFE NAME HANDLING
                    vm_name = vm.get('name')
                    if vm_name:
                        vm_name = str(vm_name).strip()
                    else:
                        vm_name = f"VM_{vm.get('mobid', 'Unknown')}"  # Fallback name
                    
                    # SAFE IP HANDLING  
                    vm_ip = vm.get('ip_address')
                    if vm_ip:
                        vm_ip = str(vm_ip).strip()
                    else:
                        vm_ip = ''
                    
                    guest_ips = vm.get('guest_ip_addresses', [])
                    if not isinstance(guest_ips, list):
                        guest_ips = []
                    
                    if not vm_name:
                        logger.warning(f"VM with mobid {vm.get('mobid', 'Unknown')} has no valid name, skipping")
                        continue
                    
                    all_vms.append(vm)
                    
                    # Index by primary IP
                    if vm_ip and self.is_valid_ip(vm_ip):
                        vms_by_ip[vm_ip] = vm
                        logger.debug(f"Indexed VM {vm_name} by primary IP: {vm_ip}")
                    
                    # Index by all guest IPs
                    for ip in guest_ips:
                        if ip and isinstance(ip, str) and self.is_valid_ip(ip.strip()):
                            clean_ip = ip.strip()
                            vms_by_ip[clean_ip] = vm
                            logger.debug(f"Indexed VM {vm_name} by guest IP: {clean_ip}")
                    
                    # Also index network IPs from networks array
                    networks = vm.get('networks', [])
                    if isinstance(networks, list):
                        for network in networks:
                            if isinstance(network, dict):
                                net_ip = network.get('ip_address')
                                if net_ip and isinstance(net_ip, str) and self.is_valid_ip(net_ip.strip()):
                                    clean_net_ip = net_ip.strip()
                                    vms_by_ip[clean_net_ip] = vm
                                    logger.debug(f"Indexed VM {vm_name} by network IP: {clean_net_ip}")
                
                logger.info(f"vCenter IP Index: {len(all_vms)} VMs, {len(vms_by_ip)} unique IPs")
                
                # Debug: Show some examples
                if len(vms_by_ip) > 0:
                    logger.info("Sample vCenter IP mappings:")
                    for i, (ip, vm_data) in enumerate(vms_by_ip.items()):
                        if i >= 5:  # Show first 5
                            break
                        vm_name = vm_data.get('name', 'Unknown')
                        logger.info(f"  {ip} -> {vm_name}")
                
                return {
                    'by_ip': vms_by_ip,
                    'all_vms': all_vms
                }
                
            except Exception as e:
                logger.error(f"Error getting vCenter VMs by IP: {e}")
                logger.exception("Full traceback:")  # This will show the full error
                return {'by_ip': {}, 'all_vms': []}
    
    def get_jira_vms_by_ip(self) -> Set[str]:
        """Get Jira VMs indexed BY IP ADDRESS ONLY - FIXED VERSION"""
        try:
            self.get_collections()
            
            jira_ips = set()          # All IP addresses
            jira_vm_details = {}      # IP -> VM details for debugging
            
            cursor = self.jira_collection.find({}, {
                'name': 1, 'vm_name': 1, 'VMName': 1,
                'ip_address': 1, 'secondary_ip': 1, 'secondary_ip2': 1,
                'jira_object_key': 1, 'jira_object_id': 1
            })
            
            for vm in cursor:
                # SAFE NAME HANDLING
                vm_names = [
                    vm.get('name'),
                    vm.get('vm_name'), 
                    vm.get('VMName')
                ]
                
                actual_vm_name = 'Unknown'
                for name in vm_names:
                    if name and isinstance(name, str):
                        actual_vm_name = name.strip()
                        break
                
                # Collect all IP addresses - SAFE HANDLING
                ips_to_check = [
                    vm.get('ip_address'),
                    vm.get('secondary_ip'),
                    vm.get('secondary_ip2')
                ]
                
                for ip in ips_to_check:
                    if ip and isinstance(ip, str):
                        clean_ip = ip.strip()
                        if clean_ip and self.is_valid_ip(clean_ip):
                            jira_ips.add(clean_ip)
                            jira_vm_details[clean_ip] = {
                                'jira_key': vm.get('jira_object_key'),
                                'vm_name': actual_vm_name,
                                'vm_data': vm
                            }
                            logger.debug(f"Indexed Jira VM {actual_vm_name} by IP: {clean_ip}")
            
            logger.info(f"Jira IP Index: {len(jira_ips)} unique IPs")
            
            # Debug: Show some examples
            if len(jira_ips) > 0:
                logger.info("Sample Jira IP mappings:")
                for i, ip in enumerate(list(jira_ips)[:5]):  # Show first 5
                    vm_details = jira_vm_details.get(ip, {})
                    vm_name = vm_details.get('vm_name', 'Unknown')
                    logger.info(f"  {ip} -> {vm_name}")
            
            return jira_ips
            
        except Exception as e:
            logger.error(f"Error getting Jira VMs by IP: {e}")
            logger.exception("Full traceback:")
            return set()
    
    def find_missing_vms_ip_only(self) -> Dict[str, Dict[str, Any]]:
        """IP-ONLY based missing VM detection - FIXED VERSION"""
        vcenter_data = self.get_vcenter_vms_by_ip()
        jira_ips = self.get_jira_vms_by_ip()
        
        missing_vms = {}
        found_by_ip = 0
        no_ip_vms = 0
        ip_conflicts = {}
        
        logger.info("=" * 60)
        logger.info("IP-ONLY VM DIFF ANALYSIS STARTED")
        logger.info(f"vCenter VMs: {len(vcenter_data['all_vms'])}")
        logger.info(f"vCenter unique IPs: {len(vcenter_data['by_ip'])}")
        logger.info(f"Jira unique IPs: {len(jira_ips)}")
        logger.info("=" * 60)
        
        # Debug check
        if len(vcenter_data['all_vms']) == 0:
            logger.error("No vCenter VMs found! Check database connection and collection name.")
            logger.error("Checking if virtual_machines collection exists...")
            
            # Collection stats for debugging
            try:
                collection_names = self.vcenter_collection.database.list_collection_names()
                logger.info(f"Available collections: {collection_names}")
                
                vm_count = self.vcenter_collection.count_documents({})
                logger.info(f"virtual_machines collection document count: {vm_count}")
                
                if vm_count > 0:
                    # Sample document
                    sample = self.vcenter_collection.find_one({})
                    logger.info(f"Sample document fields: {list(sample.keys()) if sample else 'None'}")
                    if sample:
                        logger.info(f"Sample name field: {sample.get('name')} (type: {type(sample.get('name'))})")
                        logger.info(f"Sample ip_address field: {sample.get('ip_address')} (type: {type(sample.get('ip_address'))})")
                        
            except Exception as debug_e:
                logger.error(f"Debug check error: {debug_e}")
            
            return {}
        
        # Process each vCenter VM
        for vm_data in vcenter_data['all_vms']:
            # SAFE NAME HANDLING
            vm_name = vm_data.get('name')
            if vm_name:
                vm_name = str(vm_name).strip()
            else:
                vm_name = f"VM_{vm_data.get('mobid', 'Unknown')}"
            
            # SAFE IP HANDLING
            vm_ip = vm_data.get('ip_address')
            if vm_ip:
                vm_ip = str(vm_ip).strip()
            else:
                vm_ip = ''
                
            guest_ips = vm_data.get('guest_ip_addresses', [])
            if not isinstance(guest_ips, list):
                guest_ips = []
            
            # Track matching attempts
            found_in_jira = False
            matching_ip = None
            
            # 1. Check by primary IP address
            if vm_ip and self.is_valid_ip(vm_ip):
                if vm_ip in jira_ips:
                    found_in_jira = True
                    matching_ip = vm_ip
                    found_by_ip += 1
                    logger.debug(f"✅ Primary IP match: {vm_name} -> {vm_ip}")
                    
                    # Track potential IP conflicts
                    if vm_ip in ip_conflicts:
                        ip_conflicts[vm_ip].append(vm_name)
                    else:
                        ip_conflicts[vm_ip] = [vm_name]
            
            # 2. If not found by primary IP, check by guest IP addresses
            if not found_in_jira:
                for ip in guest_ips:
                    if ip and isinstance(ip, str):
                        clean_ip = ip.strip()
                        if clean_ip and self.is_valid_ip(clean_ip) and clean_ip in jira_ips:
                            found_in_jira = True
                            matching_ip = clean_ip
                            found_by_ip += 1
                            logger.debug(f"✅ Guest IP match: {vm_name} -> {clean_ip}")
                            break
            
            # 3. Check network IPs if still not found
            if not found_in_jira:
                networks = vm_data.get('networks', [])
                if isinstance(networks, list):
                    for network in networks:
                        if isinstance(network, dict):
                            net_ip = network.get('ip_address')
                            if net_ip and isinstance(net_ip, str):
                                clean_net_ip = net_ip.strip()
                                if clean_net_ip and self.is_valid_ip(clean_net_ip) and clean_net_ip in jira_ips:
                                    found_in_jira = True
                                    matching_ip = clean_net_ip
                                    found_by_ip += 1
                                    logger.debug(f"✅ Network IP match: {vm_name} -> {clean_net_ip}")
                                    break
                        if found_in_jira:
                            break
            
            # Record results
            if found_in_jira:
                logger.debug(f"VM {vm_name} found in Jira by IP: {matching_ip}")
            else:
                # Check if VM has any valid IP
                has_valid_ip = False
                if vm_ip and self.is_valid_ip(vm_ip):
                    has_valid_ip = True
                else:
                    for ip in guest_ips:
                        if ip and isinstance(ip, str):
                            clean_ip = ip.strip()
                            if clean_ip and self.is_valid_ip(clean_ip):
                                has_valid_ip = True
                                break
                
                if has_valid_ip:
                    missing_vms[vm_name] = vm_data
                    logger.info(f"❌ Missing VM: {vm_name} (Primary IP: {vm_ip or 'N/A'})")
                else:
                    no_ip_vms += 1
                    logger.warning(f"⚠️ VM has no valid IP: {vm_name} - SKIPPED")
        
        # Process IP conflicts
        actual_conflicts = 0
        for ip, vm_names in ip_conflicts.items():
            if len(vm_names) > 1:
                actual_conflicts += 1
                logger.warning(f"⚠️ IP Conflict: {ip} -> VMs: {vm_names}")
        
        # Clean up resolved missing VMs
        self.cleanup_resolved_missing_vms_ip_only(jira_ips)
        
        # Log final statistics
        logger.info("=" * 60)
        logger.info("IP-ONLY DIFF ANALYSIS RESULTS:")
        logger.info(f"Total vCenter VMs: {len(vcenter_data['all_vms'])}")
        logger.info(f"Found by IP: {found_by_ip}")
        logger.info(f"Missing VMs (with valid IP): {len(missing_vms)}")
        logger.info(f"VMs without valid IP (skipped): {no_ip_vms}")
        logger.info(f"IP conflicts detected: {actual_conflicts}")
        
        total_with_ip = len(vcenter_data['all_vms']) - no_ip_vms
        if total_with_ip > 0:
            match_rate = (found_by_ip / total_with_ip) * 100
            logger.info(f"IP-based match rate: {match_rate:.1f}%")
        
        logger.info("=" * 60)
        
        return missing_vms
    
    def cleanup_resolved_missing_vms_ip_only(self, jira_ips: Set[str]):
        """Cleanup VMs that are now resolved by IP matching"""
        try:
            self.get_collections()
            
            cursor = self.missing_collection.find({}, {'vm_name': 1, 'vm_summary': 1, '_id': 1})
            
            resolved_vms = []
            resolved_by_ip = []
            
            for doc in cursor:
                vm_name = doc.get('vm_name', '').strip()
                vm_summary = doc.get('vm_summary', {})
                vm_ip = vm_summary.get('ip', '').strip() if isinstance(vm_summary, dict) else ''
                
                # Check if resolved by IP only
                if vm_ip and vm_ip in jira_ips:
                    resolved_vms.append(vm_name)
                    resolved_by_ip.append(vm_name)
            
            # Delete resolved VMs
            if resolved_vms:
                delete_result = self.missing_collection.delete_many({'vm_name': {'$in': resolved_vms}})
                logger.info(f"✅ {delete_result.deleted_count} resolved VMs removed from missing_vms_for_jira (IP-only method):")
                
                for vm_name in resolved_by_ip:
                    logger.info(f"  - {vm_name} (resolved by IP)")
            else:
                logger.info("No resolved VMs found to clean up (IP-only method)")
                
        except Exception as e:
            logger.error(f"Error in IP-only cleanup: {e}")
    
    def process_vm_diff(
        self,
        api_url: Optional[str] = None,
        token: Optional[str] = None,
        object_type_id: Optional[str] = None,
        object_schema_id: Optional[str] = None,
        cookie: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process VM diff between vCenter and Jira using IP-ONLY matching"""
        
        # Configure Jira service
        if api_url or token or object_type_id or object_schema_id or cookie:
            self.jira_service = JiraService(
                api_url=api_url,
                token=token,
                object_type_id=object_type_id,
                object_schema_id=object_schema_id,
                cookie=cookie
            )
        
        try:
            logger.info("IP-ONLY VM diff analysis started...")
            start_time = time.time()
            
            # Use IP-only missing VM detection
            missing_vms = self.find_missing_vms_ip_only()
            
            vcenter_data = self.get_vcenter_vms_by_ip()
            jira_ips = self.get_jira_vms_by_ip()
            
            if not missing_vms:
                logger.info("All vCenter VMs (with valid IPs) exist in Jira")
                return {
                    'status': 'success',
                    'message': 'All vCenter VMs (with valid IPs) exist in Jira (IP-only matching)',
                    'total_vcenter_vms': len(vcenter_data['all_vms']),
                    'total_jira_vms': len(jira_ips),
                    'missing_vms_count': 0,
                    'processed_missing_vms': 0,
                    'errors': 0,
                    'processing_time': time.time() - start_time,
                    'matching_method': 'ip_only_based'
                }
            
            logger.info(f"{len(missing_vms)} missing VMs found (IP-only matching)")
            
            # Show missing VM names with IPs
            logger.info("Missing VMs (IP-Only Analysis):")
            for vm_name in list(missing_vms.keys())[:10]:  # Show first 10
                vm_data = missing_vms[vm_name]
                vm_ip = vm_data.get('ip_address', 'N/A')
                logger.info(f"  - {vm_name} (IP: {vm_ip})")
            if len(missing_vms) > 10:
                logger.info(f"  ... and {len(missing_vms) - 10} more VMs")
            
            # Save missing VMs to MongoDB in Jira Asset format
            result = self.save_missing_vms_to_mongodb(missing_vms)
            
            end_time = time.time()
            processing_time = end_time - start_time
            
            # Log results
            logger.info("=" * 50)
            logger.info("IP-ONLY VM DIFF PROCESSOR RESULTS:")
            logger.info(f"Missing VM count: {result['total']}")
            logger.info(f"Successfully processed: {result['processed']}")
            logger.info(f"Errors: {result['errors']}")
            logger.info(f"Processing time: {processing_time:.2f} seconds")
            logger.info("=" * 50)
            
            if result['processed'] > 0:
                logger.info(f"✅ {result['processed']} VMs written to 'missing_vms_for_jira' collection")
                logger.info("🔄 These VMs are ready to be POSTed to Jira Asset Manager")
            
            return {
                'status': 'success',
                'message': f'{result["processed"]} missing VMs processed successfully (IP-only matching)',
                'total_vcenter_vms': len(vcenter_data['all_vms']),
                'total_jira_vms': len(jira_ips),
                'missing_vms_count': len(missing_vms),
                'processed_missing_vms': result['processed'],
                'errors': result['errors'],
                'processing_time': processing_time,
                'matching_method': 'ip_only_based'
            }
            
        except Exception as e:
            logger.error(f"IP-only VM diff processing error: {e}")
            return {
                'status': 'error',
                'message': f'IP-only VM diff processing error: {str(e)}',
                'total_vcenter_vms': 0,
                'total_jira_vms': 0,
                'missing_vms_count': 0,
                'processed_missing_vms': 0,
                'errors': 0,
                'processing_time': 0,
                'matching_method': 'ip_only_based'
            }

    # Keep the existing helper methods
    def extract_tag_value(self, vm_data: Dict[str, Any], tag_key: str, array_name: str = 'tags') -> Optional[str]:
        """Extract tag value from VM tag array"""
        try:
            tag_arrays = vm_data.get(array_name, [])
            if not tag_arrays or not isinstance(tag_arrays, list):
                return None
                
            for tag_array in tag_arrays:
                if isinstance(tag_array, dict) and tag_key in tag_array:
                    return tag_array[tag_key]
            
            return None
        except Exception as e:
            logger.debug(f"Tag value extraction error {tag_key}: {e}")
            return None
    
    def map_vcenter_os_to_jira_os(self, guest_os: str) -> Optional[str]:
        """Map vCenter guest_os to Jira Operating System object name"""
        if not guest_os:
            return None
            
        guest_os_lower = guest_os.lower()
        
        # vCenter guest_os -> Jira Operating System mapping
        if 'red hat' in guest_os_lower or 'rhel' in guest_os_lower:
            return 'RHEL'
        elif 'centos' in guest_os_lower:
            return 'Centos'
        elif 'oracle' in guest_os_lower:
            return 'OEL'
        elif 'windows' in guest_os_lower:
            return 'Windows'
        else:
            return None  # Unknown OS
    
    def create_jira_asset_payload(self, vm_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create Jira Asset payload from vCenter VM data"""
        try:
            vm_name = vm_data.get('name', '').strip()
            
            # Get basic information
            site = self.extract_tag_value(vm_data, 'Site', 'tags_jira_asset') or 'Main'
            zone = self.extract_tag_value(vm_data, 'Zone', 'tags_jira_asset') or 'Bank'  
            vm_environment = self.extract_tag_value(vm_data, 'Environment', 'tags_jira_asset') or 'Prod'
            ip_address = vm_data.get('ip_address', '') or ''
            created_by = self.extract_tag_value(vm_data, 'CreatedBy', 'tags') or 'Terraform'
            
            # Hardware information
            cpu = vm_data.get('cpu_count', 0) or 0
            memory = vm_data.get('memory_gb', 0) or 0
            
            # Calculate disk size
            disk = 0
            disks = vm_data.get('disks', [])
            if disks:
                for disk_info in disks:
                    disk += disk_info.get('capacity_gb', 0) or 0
            
            # Other information
            description = vm_data.get('annotation', '') or ''  
            resource_pool = vm_data.get('resource_pool', '') or ''
            
            # Get System and Component values from tags_jira_asset
            system_value = self.extract_tag_value(vm_data, 'System', 'tags_jira_asset')
            component_value = self.extract_tag_value(vm_data, 'Component', 'tags_jira_asset')
            
            # For OperatingSystem, first check tags_jira_asset, then map from guest_os
            os_value = (self.extract_tag_value(vm_data, 'OperatingSystem', 'tags_jira_asset') or 
                       self.extract_tag_value(vm_data, 'OS', 'tags_jira_asset') or
                       self.extract_tag_value(vm_data, 'Osname', 'tags_jira_asset'))
            
            # If no OS in tags_jira_asset, map from guest_os
            if not os_value:
                guest_os = vm_data.get('guest_os', '')
                os_value = self.map_vcenter_os_to_jira_os(guest_os)
                logger.info(f"VM {vm_name} - guest_os '{guest_os}' mapped to '{os_value}'")
            
            logger.info(f"VM {vm_name} - System: {system_value}, Component: {component_value}, OS: {os_value}")
            
            # Get ITAM numbers
            system_itam = 'Unknown'
            if system_value:
                itam_result = self.jira_service.get_itam_number_by_label(system_value, '3006')  # Business Application
                system_itam = itam_result if itam_result else self.jira_service.get_itam_number_by_label('Unknown', '3006')
                logger.info(f"System '{system_value}' -> ITAM: {system_itam}")
            else:
                # If no system value, get "Unknown" ITAM directly
                system_itam = self.jira_service.get_itam_number_by_label('Unknown', '3006') or 'Unknown'
                logger.info(f"No system value found, using Unknown -> ITAM: {system_itam}")
            
            component_itam = 'Unknown'
            if component_value:
                itam_result = self.jira_service.get_itam_number_by_label(component_value, '3233')  # Components
                component_itam = itam_result if itam_result else self.jira_service.get_itam_number_by_label('Unknown', '3233')
                logger.info(f"Component '{component_value}' -> ITAM: {component_itam}")
            else:
                # If no component value, get "Unknown" ITAM directly
                component_itam = self.jira_service.get_itam_number_by_label('Unknown', '3233') or 'Unknown'
                logger.info(f"No component value found, using Unknown -> ITAM: {component_itam}")
            
            osname_itam = 'Unknown'
            if os_value:
                itam_result = self.jira_service.get_itam_number_by_label(os_value, '3236')  # Operating Systems
                osname_itam = itam_result if itam_result else self.jira_service.get_itam_number_by_label('Unknown', '3236')
                logger.info(f"OS '{os_value}' -> ITAM: {osname_itam}")
            else:
                # If no OS value, get "Unknown" ITAM directly
                osname_itam = self.jira_service.get_itam_number_by_label('Unknown', '3236') or 'Unknown'
                logger.info(f"No OS value found, using Unknown -> ITAM: {osname_itam}")
            
            # Create Jira Asset payload - always with all attributes
            payload = {
                "objectTypeId": "3191",
                "attributes": [
                    {"objectTypeAttributeId": 14590, "objectAttributeValues": [{"value": vm_name}]},  # VMName
                    {"objectTypeAttributeId": 14591, "objectAttributeValues": [{"value": vm_name}]},  # DNSName
                    {"objectTypeAttributeId": 14594, "objectAttributeValues": [{"value": site}]},     # Site
                    {"objectTypeAttributeId": 14595, "objectAttributeValues": [{"value": zone}]},     # Zone
                    {"objectTypeAttributeId": 14596, "objectAttributeValues": [{"value": vm_environment}]}, # Environment
                    {"objectTypeAttributeId": 14599, "objectAttributeValues": [{"value": ip_address}]}, # IPAddress
                    {"objectTypeAttributeId": 14611, "objectAttributeValues": [{"value": created_by}]}, # CreatedBy
                    {"objectTypeAttributeId": 14780, "objectAttributeValues": [{"value": component_itam}]}, # Component
                    {"objectTypeAttributeId": 14603, "objectAttributeValues": [{"value": str(cpu)}]}, # CPU
                    {"objectTypeAttributeId": 14604, "objectAttributeValues": [{"value": str(memory)}]}, # Memory
                    {"objectTypeAttributeId": 14605, "objectAttributeValues": [{"value": str(disk)}]}, # Disk
                    {"objectTypeAttributeId": 14606, "objectAttributeValues": [{"value": description}]}, # Description
                    {"objectTypeAttributeId": 14612, "objectAttributeValues": [{"value": resource_pool}]}, # ResourcePool
                    {"objectTypeAttributeId": 14820, "objectAttributeValues": [{"value": osname_itam}]}, # OperatingSystem
                    {"objectTypeAttributeId": 14817, "objectAttributeValues": [{"value": system_itam}]}  # System
                ]
            }
            
            # Debug information
            debug_info = {
                'vm_name': vm_name,
                'source_system_value': system_value,
                'system_itam': system_itam,
                'source_component_value': component_value,
                'component_itam': component_itam,
                'source_os_value': os_value,
                'osname_itam': osname_itam,
                'vcenter_guest_os': vm_data.get('guest_os', ''),
                'vcenter_uuid': vm_data.get('uuid'),
                'vcenter_mobid': vm_data.get('mobid'),
                'processing_date': datetime.utcnow(),
                'matching_method': 'ip_only_based'
            }
            
            return {
                'jira_payload': payload,
                'debug_info': debug_info,
                'vm_data_summary': {
                    'name': vm_name,
                    'cpu': cpu,
                    'memory': memory,
                    'disk': disk,
                    'ip': ip_address,
                    'site': site,
                    'zone': zone,
                    'environment': vm_environment
                }
            }
            
        except Exception as e:
            logger.error(f"Error creating Jira Asset payload for {vm_data.get('name', 'Unknown')}: {e}")
            return None
    
    def save_missing_vms_to_mongodb(self, missing_vms: Dict[str, Dict[str, Any]]) -> Dict[str, int]:
        """Save missing VMs to MongoDB in Jira Asset format"""
        try:
            self.get_collections()
            
            operations = []
            processed_count = 0
            error_count = 0
            
            for vm_name, vm_data in missing_vms.items():
                try:
                    payload_data = self.create_jira_asset_payload(vm_data)
                    
                    if payload_data:
                        # Create MongoDB document
                        document = {
                            'vm_name': vm_name,
                            'jira_asset_payload': payload_data['jira_payload'],
                            'debug_info': payload_data['debug_info'],
                            'vm_summary': payload_data['vm_data_summary'],
                            'status': 'pending_creation',
                            'created_date': datetime.utcnow(),
                            'source': 'vcenter_diff_processor_ip_only'
                        }
                        
                        operation = UpdateOne(
                            {'vm_name': vm_name},
                            {'$set': document},
                            upsert=True
                        )
                        operations.append(operation)
                        processed_count += 1
                        
                    else:
                        error_count += 1
                        
                except Exception as e:
                    logger.error(f"Error creating payload for VM {vm_name}: {e}")
                    error_count += 1
            
            # Bulk write operation
            if operations:
                try:
                    result = self.missing_collection.bulk_write(operations, ordered=False)
                    logger.info(f"Written to MongoDB: {result.upserted_count} new, {result.modified_count} updated")
                except BulkWriteError as e:
                    logger.error(f"Bulk write error: {e}")
            
            return {
                'processed': processed_count,
                'errors': error_count,
                'total': len(missing_vms)
            }
            
        except Exception as e:
            logger.error(f"MongoDB save error: {e}")
            return {'processed': 0, 'errors': len(missing_vms), 'total': len(missing_vms)}

"""
Jira Asset Management integration service
"""

import json
import logging
import requests
import urllib3
from datetime import datetime
from typing import List, Dict, Optional, Any

from app.core.config import settings

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


class JiraService:
    """Jira Asset Management service class"""
    
    def __init__(self, api_url: str = None, token: str = None, object_type_id: str = None, 
                 object_schema_id: str = None, cookie: str = None):
        self.api_url = api_url or "https://jira-support.company.com/rest/insight/1.0/object/navlist/iql"
        self.token = token or "your_token_here"
        self.object_type_id = object_type_id or "3191"
        self.object_schema_id = object_schema_id or "242"
        self.cookie = cookie or ""
        self.session = None
        
    def get_session(self):
        """Get Jira API session"""
        try:
            if self.session:
                return self.session
                
            session = requests.Session()
            session.verify = False
            
            # Add authorization headers - try multiple formats
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'VMware-Collector/1.0'
            }
            
            # Try different authentication methods
            if self.token and self.token != "your_token_here":
                # Method 1: Bearer token
                headers['Authorization'] = f"Bearer {self.token}"
                print(f"DEBUG: Using Bearer token: {self.token[:20]}...")
                
            # Add cookie if available (this might be the main auth method)
            if self.cookie:
                headers['Cookie'] = self.cookie
                print(f"DEBUG: Using cookie: {self.cookie[:50]}...")
            
            session.headers.update(headers)
            
            # Test the session with a simple request
            try:
                test_payload = {
                    "objectTypeId": self.object_type_id,
                    "attributesToDisplay": {"attributesToDisplayIds": []},
                    "resultsPerPage": 1,
                    "includeAttributes": False,
                    "objectSchemaId": self.object_schema_id,
                    "qlQuery": ""
                }
                
                print(f"DEBUG: Testing auth with URL: {self.api_url}")
                print(f"DEBUG: Payload: {test_payload}")
                print(f"DEBUG: Headers: {headers}")
                
                test_response = session.post(self.api_url, json=test_payload)
                print(f"DEBUG: Response status: {test_response.status_code}")
                print(f"DEBUG: Response headers: {dict(test_response.headers)}")
                print(f"DEBUG: Response body: {test_response.text[:300]}")
                
                if test_response.status_code == 401:
                    print("ERROR: 401 - Authentication failed")
                    
                    # Try cookie-only authentication
                    if self.cookie:
                        cookie_headers = {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'Cookie': self.cookie
                        }
                        cookie_response = session.post(self.api_url, json=test_payload, headers=cookie_headers)
                        print(f"DEBUG: Cookie-only auth response: {cookie_response.status_code}")
                        
                        if cookie_response.status_code == 200:
                            print("SUCCESS: Cookie authentication works")
                            session.headers.clear()
                            session.headers.update(cookie_headers)
                        
                elif test_response.status_code == 200:
                    print("SUCCESS: Authentication successful")
                else:
                    print(f"WARNING: Unexpected status: {test_response.status_code}")
                    
            except Exception as e:
                print(f"ERROR: Authentication test exception: {e}")
            
            self.session = session
            return session
            
        except Exception as e:
            print(f"ERROR: Session creation failed: {e}")
            return None
    
    def get_all_vm_objects(self) -> List[Dict[str, Any]]:
        """Get all VM objects from Jira"""
        try:
            session = self.get_session()
            if not session:
                return []
            
            all_vms = []
            page = 1
            results_per_page = 100  # Larger batch for performance
            
            while True:
                logger.info(f"Loading page {page}...")
                
                payload = {
                    "objectTypeId": self.object_type_id,
                    "attributesToDisplay": {
                        "attributesToDisplayIds": []
                    },
                    "resultsPerPage": results_per_page,
                    "includeAttributes": True,
                    "objectSchemaId": self.object_schema_id,
                    "qlQuery": "",
                    "page": page
                }
                
                response = session.post(self.api_url, json=payload)
                
                if response.status_code != 200:
                    logger.error(f"API request error: {response.status_code} - {response.text}")
                    break
                
                data = response.json()
                vm_objects = data.get('objectEntries', [])
                
                if not vm_objects:
                    logger.info("No more VMs found, collection completed")
                    break
                
                all_vms.extend(vm_objects)
                logger.info(f"Page {page}: retrieved {len(vm_objects)} VMs")
                
                # If this page has fewer VMs than requested, it's the last page
                if len(vm_objects) < results_per_page:
                    break
                    
                page += 1
            
            logger.info(f"Total {len(all_vms)} VMs retrieved")
            return all_vms
            
        except Exception as e:
            logger.error(f"Error retrieving VM objects: {e}")
            return []
    
    def extract_vm_data(self, jira_vm_object: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract structured data from Jira VM object"""
        try:
            vm_data = {
                'jira_object_id': jira_vm_object.get('id'),
                'jira_object_key': jira_vm_object.get('objectKey'),
                'name': jira_vm_object.get('label', '').strip(),
                'created_date': jira_vm_object.get('created'),
                'updated_date': jira_vm_object.get('updated'),
                'last_updated': datetime.utcnow(),
                'data_source': 'jira_asset_management'
            }
            
            # Extract data from attributes
            attributes = jira_vm_object.get('attributes', [])
            attribute_data = {}
            
            for attr in attributes:
                attr_name = attr.get('objectTypeAttribute', {}).get('name')
                attr_values = attr.get('objectAttributeValues', [])
                
                if not attr_name or not attr_values:
                    continue
                
                # Handle different attribute types for value extraction
                if len(attr_values) == 1:
                    value_obj = attr_values[0]
                    
                    # Reference type (reference to another object)
                    if value_obj.get('referencedType'):
                        referenced_obj = value_obj.get('referencedObject', {})
                        attribute_data[attr_name] = {
                            'id': referenced_obj.get('id'),
                            'name': referenced_obj.get('name'),
                            'label': referenced_obj.get('label'),
                            'object_key': referenced_obj.get('objectKey')
                        }
                    # User type
                    elif 'user' in value_obj:
                        user = value_obj.get('user', {})
                        attribute_data[attr_name] = {
                            'name': user.get('name'),
                            'display_name': user.get('displayName'),
                            'key': user.get('key')
                        }
                    # Simple value
                    else:
                        attribute_data[attr_name] = value_obj.get('value')
                
                # Multiple values
                else:
                    values = []
                    for value_obj in attr_values:
                        if value_obj.get('referencedType'):
                            referenced_obj = value_obj.get('referencedObject', {})
                            values.append({
                                'id': referenced_obj.get('id'),
                                'name': referenced_obj.get('name'),
                                'label': referenced_obj.get('label'),
                                'object_key': referenced_obj.get('objectKey')
                            })
                        else:
                            values.append(value_obj.get('value'))
                    attribute_data[attr_name] = values
            
            # Add structured data
            vm_data.update(attribute_data)
            
            # Create tag format for mapping
            tags = {}
            jira_tags = {}
            
            # Map attributes to tag format
            tag_mapping = {
                'SystemName': 'System',
                'Zone': 'Zone', 
                'Environment': 'Environment',
                'Component': 'Component',
                'ComponentType': 'ComponentType',
                'Team': 'Team',
                'System': 'System'
            }
            
            for jira_attr, tag_key in tag_mapping.items():
                if jira_attr in attribute_data and attribute_data[jira_attr]:
                    attr_value = attribute_data[jira_attr]
                    
                    # If reference type, get name field
                    if isinstance(attr_value, dict) and 'name' in attr_value:
                        tags[tag_key] = attr_value['name']
                        jira_tags[tag_key] = attr_value['name']
                    # Simple string
                    elif isinstance(attr_value, str):
                        tags[tag_key] = attr_value
                        jira_tags[tag_key] = attr_value
            
            # Add tag formats
            if tags:
                vm_data['tags'] = [tags]
                vm_data['tags_jira_asset'] = [jira_tags]
            else:
                vm_data['tags'] = []
                vm_data['tags_jira_asset'] = []
            
            # Map comprehensive VM details
            self._map_vm_details(vm_data, attribute_data)
            
            return vm_data
            
        except Exception as e:
            logger.error(f"Error extracting VM data for {jira_vm_object.get('objectKey', 'Unknown')}: {e}")
            return None
    
    def _map_vm_details(self, vm_data: Dict[str, Any], attribute_data: Dict[str, Any]):
        """Map VM attributes to structured data"""
        
        # Basic VM info
        if 'VMName' in attribute_data:
            vm_data['vm_name'] = attribute_data['VMName']
        if 'DNSName' in attribute_data:
            vm_data['dns_name'] = attribute_data['DNSName']
        
        # Network info
        if 'IPAddress' in attribute_data:
            vm_data['ip_address'] = attribute_data['IPAddress']
        if 'SecondaryIP' in attribute_data:
            vm_data['secondary_ip'] = attribute_data['SecondaryIP']
        if 'SecondaryIP2' in attribute_data:
            vm_data['secondary_ip2'] = attribute_data['SecondaryIP2']
        
        # Hardware info
        if 'CPU' in attribute_data:
            try:
                vm_data['cpu_count'] = int(attribute_data['CPU']) if attribute_data['CPU'] else 0
            except (ValueError, TypeError):
                vm_data['cpu_count'] = 0
                
        if 'Memory' in attribute_data:
            try:
                memory_gb = int(attribute_data['Memory']) if attribute_data['Memory'] else 0
                vm_data['memory_gb'] = memory_gb
                vm_data['memory_mb'] = memory_gb * 1024
            except (ValueError, TypeError):
                vm_data['memory_gb'] = 0
                vm_data['memory_mb'] = 0
                
        if 'Disk' in attribute_data:
            try:
                vm_data['disk_gb'] = int(attribute_data['Disk']) if attribute_data['Disk'] else 0
            except (ValueError, TypeError):
                vm_data['disk_gb'] = 0
        
        # Infrastructure info
        if 'ResourcePool' in attribute_data:
            vm_data['resource_pool'] = attribute_data['ResourcePool']
        if 'Datastore' in attribute_data:
            vm_data['datastore'] = attribute_data['Datastore']
        if 'ESXiCluster' in attribute_data:
            vm_data['esxi_cluster'] = attribute_data['ESXiCluster']
        if 'ESXiHost' in attribute_data:
            vm_data['esxi_host'] = attribute_data['ESXiHost']
        if 'ESXiPortGroup' in attribute_data:
            vm_data['esxi_port_group'] = attribute_data['ESXiPortGroup']
        
        # Management info
        if 'Site' in attribute_data:
            vm_data['site'] = attribute_data['Site']
        if 'Description' in attribute_data:
            vm_data['description'] = attribute_data['Description']
        if 'JiraTicket' in attribute_data:
            vm_data['jira_ticket'] = attribute_data['JiraTicket']
        if 'CriticalityLevel' in attribute_data:
            vm_data['criticality_level'] = attribute_data['CriticalityLevel']
        if 'CreatedBY' in attribute_data:
            vm_data['created_by'] = attribute_data['CreatedBY']
        
        # Backup info
        if 'NeedBackup' in attribute_data:
            vm_data['need_backup'] = attribute_data['NeedBackup']
        if 'BackupType' in attribute_data:
            vm_data['backup_type'] = attribute_data['BackupType']
        if 'NeedMonitoring' in attribute_data:
            vm_data['need_monitoring'] = attribute_data['NeedMonitoring']
        
        # Operating System (reference object)
        if 'OperatingSystem' in attribute_data:
            os_obj = attribute_data['OperatingSystem']
            if isinstance(os_obj, dict):
                vm_data['operating_system'] = os_obj.get('name', '')
            else:
                vm_data['operating_system'] = str(os_obj) if os_obj else ''
        
        # Platform (reference object) 
        if 'Platform' in attribute_data:
            platform_obj = attribute_data['Platform']
            if isinstance(platform_obj, dict):
                vm_data['platform'] = platform_obj.get('name', '')
            else:
                vm_data['platform'] = str(platform_obj) if platform_obj else ''
        
        # ResponsibleTTL (user object)
        if 'ResponsibleTTL' in attribute_data:
            user_obj = attribute_data['ResponsibleTTL']
            if isinstance(user_obj, dict):
                vm_data['responsible_ttl'] = {
                    'name': user_obj.get('name', ''),
                    'display_name': user_obj.get('display_name', ''),
                    'key': user_obj.get('key', '')
                }
        
        # KubernetesCluster (reference object)
        if 'KubernetesCluster' in attribute_data:
            k8s_obj = attribute_data['KubernetesCluster']
            if isinstance(k8s_obj, dict):
                vm_data['kubernetes_cluster'] = k8s_obj.get('name', '')
    
    def get_object_key_by_label(self, data: Dict[str, Any], label: str) -> Optional[str]:
        """Find object key by label in data"""
        for entry in data.get("objectEntries", []):
            for attribute in entry.get("attributes", []):
                object_type_attr = attribute.get("objectTypeAttribute", {})
                if object_type_attr.get("label") and attribute.get("objectAttributeValues", []):
                    attr_values = attribute.get("objectAttributeValues", [])
                    if attr_values and attr_values[0].get("value") == label:
                        return entry.get("objectKey")
        return None

    def fetch_data_from_api(self, object_type_id: str) -> Optional[Dict[str, Any]]:
        """Fetch data from Jira API"""
        try:
            session = self.get_session()
            if not session:
                return None
                
            payload = {
                "objectTypeId": f"{object_type_id}",
                "attributesToDisplay": {"attributesToDisplayIds": []},
                "resultsPerPage": 1000,
                "includeAttributes": True,
                "objectSchemaId": self.object_schema_id,
                "qlQuery": ""
            }
            
            response = session.post(self.api_url, json=payload)
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"API call failed with status code {response.status_code}" )
                return None
                
        except Exception as e:
            logger.error(f"API request error: {e}")
            return None
    
    def get_itam_number_by_label(self, label: str, object_type_id: str) -> Optional[str]:
        """Get ITAM number by label - with better error handling"""
        try:
            # Skip ITAM lookup if no proper authentication
            if not self.token or self.token == "your_token_here":
                logger.warning("No valid token available for ITAM lookup, skipping")
                return None
                
            data = self.fetch_data_from_api(object_type_id)
            if not data:
                logger.warning(f"No data received for object type {object_type_id}")
                return None
                
            object_key = self.get_object_key_by_label(data, label)
            if object_key and not object_key.startswith("No ObjectKey found"):
                logger.debug(f"Label '{label}' ITAM: {object_key}")
                return object_key
            else:
                logger.debug(f"ITAM not found for label '{label}' in object type {object_type_id}")
                return None
                
        except Exception as e:
            logger.warning(f"Error getting ITAM number for '{label}': {e}")
            return None
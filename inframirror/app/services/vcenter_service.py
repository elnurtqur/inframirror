"""
vCenter integration service
"""

import ssl
import logging
import requests
import urllib3
import base64
from datetime import datetime
from typing import List, Dict, Optional, Any

from pyVim.connect import SmartConnect, Disconnect
from pyVmomi import vim, vmodl

from app.core.config import settings

# SSL xəbərdarlıqlarını söndür
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


class VCenterService:
    """vCenter service class"""
    
    def __init__(self, host: str = None, username: str = None, password: str = None, port: int = None, default_site: str = None, default_zone: str = None):
        self.host = host or settings.vcenter_host
        self.username = username or settings.vcenter_username
        self.password = password or settings.vcenter_password
        self.port = port or settings.vcenter_port
        self.default_site = default_site
        self.default_zone = default_zone
        self.session_id = None
        self.rest_session = None
    
    def connect_vcenter(self):
        """vCenter'a bağlantı"""
        try:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            
            si = SmartConnect(
                host=self.host,
                user=self.username,
                pwd=self.password,
                port=self.port,
                sslContext=context
            )
            
            logger.info(f"vCenter bağlantısı uğurlu: {self.host}")
            return si
        except Exception as e:
            logger.error(f"vCenter bağlantı xətası: {e}")
            return None
    
    def get_rest_session(self):
        """vCenter REST API sessiyası əldə et"""
        try:
            if self.rest_session:
                return self.rest_session
                
            session = requests.Session()
            session.verify = False
            
            auth_endpoints = [
                f"https://{self.host}/api/session",
                f"https://{self.host}/rest/com/vmware/cis/session"
            ]
            
            auth_data = f"{self.username}:{self.password}"
            auth_header = base64.b64encode(auth_data.encode()).decode()
            
            headers = {
                'Authorization': f'Basic {auth_header}',
                'Content-Type': 'application/json'
            }
            
            for auth_url in auth_endpoints:
                try:
                    response = session.post(auth_url, headers=headers)
                    
                    if response.status_code == 200:
                        session_data = response.json()
                        
                        if 'value' in session_data:
                            self.session_id = session_data['value']
                        elif isinstance(session_data, str):
                            self.session_id = session_data
                        else:
                            self.session_id = str(session_data)
                        
                        session.headers.update({
                            'vmware-api-session-id': self.session_id,
                            'vmware-use-header-authn': 'test'
                        })
                        
                        self.rest_session = session
                        logger.debug(f"REST API sessiya uğurlu: {auth_url}")
                        return session
                        
                except Exception as e:
                    logger.debug(f"Auth endpoint {auth_url} xəta: {e}")
                    continue
            
            logger.error("REST API sessiya yaradılmadı")
            return None
                
        except Exception as e:
            logger.error(f"REST API sessiya xətası: {e}")
            return None
    
    def get_all_vm_refs(self, si) -> List[Dict[str, Any]]:
        """Bütün VM'lərin referanslarını əldə et"""
        try:
            content = si.RetrieveContent()
            container = content.rootFolder
            viewType = [vim.VirtualMachine]
            recursive = True
            
            containerView = content.viewManager.CreateContainerView(
                container, viewType, recursive
            )
            
            vms = containerView.view
            vm_refs = []
            
            for vm in vms:
                try:
                    vm_refs.append({
                        'vmid': vm._moId,
                        'name': vm.name,
                        'uuid': vm.config.uuid if vm.config else None
                    })
                except Exception as e:
                    logger.warning(f"VM ref əldə etmə xətası: {e}")
                    continue
            
            containerView.Destroy()
            logger.info(f"Toplam {len(vm_refs)} VM ref əldə edildi")
            return vm_refs
            
        except Exception as e:
            logger.error(f"VM ref'ləri əldə etmə xətası: {e}")
            return []
    
    def find_vm_by_ref(self, si, vm_ref: Dict[str, Any]):
        """VM referansı ilə VM obyektini tap"""
        try:
            content = si.RetrieveContent()
            
            # UUID ilə axtarış
            if vm_ref.get('uuid'):
                searchIndex = content.searchIndex
                vm = searchIndex.FindByUuid(None, vm_ref['uuid'], True, True)
                if vm:
                    return vm
            
            # vmid ilə axtarış
            container = content.rootFolder
            viewType = [vim.VirtualMachine]
            recursive = True
            
            containerView = content.viewManager.CreateContainerView(
                container, viewType, recursive
            )
            
            for vm in containerView.view:
                if vm._moId == vm_ref['vmid']:
                    containerView.Destroy()
                    return vm
            
            containerView.Destroy()
            return None
            
        except Exception as e:
            logger.error(f"VM {vm_ref.get('name', 'Unknown')} axtarış xətası: {e}")
            return None
    
    def get_vm_tags_multiple_methods(self, si, vm, vm_vmid: str) -> List[Dict[str, Any]]:
        """Müxtəlif metodlarla VM tag'larını əldə et"""
        tags = []
        
        # Method 1: vSphere REST API
        try:
            tags = self.get_vm_tags_rest_v7(vm_vmid)
            if tags:
                return tags
        except Exception as e:
            logger.debug(f"REST API v7 tag xətası: {e}")
        
        # Method 2: CIS REST API
        try:
            tags = self.get_vm_tags_rest_cis(vm_vmid)
            if tags:
                return tags
        except Exception as e:
            logger.debug(f"CIS REST API tag xətası: {e}")
        
        # Method 3: Custom Attributes
        try:
            tags = self.get_vm_custom_attributes(vm)
            if tags:
                return tags
        except Exception as e:
            logger.debug(f"Custom attributes xətası: {e}")
        
        return []
    
    def get_vm_tags_rest_v7(self, vm_vmid: str) -> List[Dict[str, Any]]:
        """vSphere 7+ REST API ilə tag'lar"""
        try:
            session = self.get_rest_session()
            if not session:
                return []
            
            url = f"https://{self.host}/api/cis/tagging/tag-association?action=list-attached-tags"
            payload = {
                "object_id": {
                    "id": vm_vmid,
                    "type": "VirtualMachine"
                }
            }
            
            response = session.post(url, json=payload)
            if response.status_code == 200:
                return self.process_rest_tags(session, response.json())
            
        except Exception as e:
            raise e
        return []
    
    def get_vm_tags_rest_cis(self, vm_vmid: str) -> List[Dict[str, Any]]:
        """CIS REST API ilə tag'lar"""
        try:
            session = self.get_rest_session()
            if not session:
                return []
            
            url = f"https://{self.host}/rest/com/vmware/cis/tagging/tag-association?~action=list-attached-tags"
            payload = {
                "object_id": {
                    "id": vm_vmid,
                    "type": "VirtualMachine"
                }
            }
            
            response = session.post(url, json=payload)
            if response.status_code == 200:
                return self.process_rest_tags(session, response.json())
            
        except Exception as e:
            raise e
        return []
    
    def process_rest_tags(self, session, response_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """REST API tag cavabını emal et"""
        tag_ids = response_data.get('value', [])
        if not tag_ids:
            return []
        
        vm_tags = []
        for tag_id in tag_ids:
            try:
                tag_data = None
                
                # Tag məlumatları
                tag_url = f"https://{self.host}/api/cis/tagging/tag/{tag_id}"
                response = session.get(tag_url)
                if response.status_code == 200:
                    tag_data = response.json()
                else:
                    tag_url = f"https://{self.host}/rest/com/vmware/cis/tagging/tag/id:{tag_id}"
                    response = session.get(tag_url)
                    if response.status_code == 200:
                        tag_data = response.json().get('value', {})
                
                if tag_data:
                    category_id = tag_data.get('category_id')
                    category_data = {}
                    
                    if category_id:
                        cat_url = f"https://{self.host}/api/cis/tagging/category/{category_id}"
                        cat_response = session.get(cat_url)
                        if cat_response.status_code == 200:
                            category_data = cat_response.json()
                        else:
                            cat_url = f"https://{self.host}/rest/com/vmware/cis/tagging/category/id:{category_id}"
                            cat_response = session.get(cat_url)
                            if cat_response.status_code == 200:
                                category_data = cat_response.json().get('value', {})
                    
                    vm_tags.append({
                        'tag_id': tag_id,
                        'tag_name': tag_data.get('name'),
                        'tag_description': tag_data.get('description'),
                        'category_id': category_id,
                        'category_name': category_data.get('name'),
                        'category_description': category_data.get('description'),
                        'category_cardinality': category_data.get('cardinality')
                    })
                
            except Exception as e:
                logger.warning(f"Tag {tag_id} məlumatı xətası: {e}")
                continue
        
        return vm_tags
    
    def get_vm_custom_attributes(self, vm) -> List[Dict[str, Any]]:
        """Custom Attributes"""
        try:
            custom_attrs = []
            if vm.config and hasattr(vm.config, 'extraConfig'):
                for config in vm.config.extraConfig:
                    if config.key.startswith('guestinfo.tag.') or config.key.startswith('tag.'):
                        custom_attrs.append({
                            'tag_id': f'custom_{config.key}',
                            'tag_name': config.value,
                            'tag_description': f'Custom attribute: {config.key}',
                            'category_id': 'custom_attributes',
                            'category_name': 'Custom Attributes',
                            'category_description': 'VM Custom Attributes as tags',
                            'category_cardinality': 'MULTIPLE'
                        })
            
            if vm.availableField:
                for field in vm.availableField:
                    if 'tag' in field.name.lower():
                        custom_attrs.append({
                            'tag_id': f'field_{field.key}',
                            'tag_name': field.name,
                            'tag_description': field.summary or field.name,
                            'category_id': 'available_fields',
                            'category_name': 'Available Fields',
                            'category_description': 'VM Available Fields as tags',
                            'category_cardinality': 'MULTIPLE'
                        })
            
            return custom_attrs
        except Exception as e:
            raise e
    
    def extract_vm_data(self, si, vm) -> Optional[Dict[str, Any]]:
        """VM məlumatlarını çıxar - VMID dəstəyi ilə"""
        try:
            # VM əsas məlumatları
            vm_data = {
                'name': vm.name,
                'mobid': vm._moId,
                'uuid': vm.config.uuid if vm.config else None,
                'instance_uuid': vm.config.instanceUuid if vm.config else None,
                'power_state': str(vm.runtime.powerState) if vm.runtime else None,
                'guest_os': vm.config.guestFullName if vm.config else None,
                'vm_version': vm.config.version if vm.config else None,
                'annotation': vm.config.annotation if vm.config else None,
                'created_date': vm.config.createDate if vm.config else None,
                'last_updated': datetime.utcnow(),
            }
            
            # ✅ VMID məlumatını əldə et
            vmid = None
            
            # Method 1: VM Config-dən VMID custom attribute olaraq
            if vm.config and hasattr(vm.config, 'extraConfig'):
                for config in vm.config.extraConfig:
                    if config.key.lower() in ['vmid', 'vm_id', 'guestinfo.vmid']:
                        vmid = config.value
                        logger.debug(f"VMID found in extraConfig: {vmid}")
                        break
            
            # Method 2: Custom Values-dan
            if not vmid and vm.customValue:
                for custom_val in vm.customValue:
                    # Custom field key'ini yoxla
                    if hasattr(custom_val, 'key') and custom_val.key:
                        # Available field'ləri yoxla
                        if vm.availableField:
                            for field in vm.availableField:
                                if (field.key == custom_val.key and 
                                    field.name and 
                                    'vmid' in field.name.lower()):
                                    vmid = custom_val.value
                                    logger.debug(f"VMID found in custom values: {vmid}")
                                    break
                        if vmid:
                            break
            
            # Method 3: Annotation-dan VMID axtarışı
            if not vmid and vm.config and vm.config.annotation:
                annotation = vm.config.annotation.lower()
                # Annotation mətnindən VMID axtarışı
                import re
                vmid_patterns = [
                    r'vmid[:\s=]+(\w+)',
                    r'vm[-_]?id[:\s=]+(\w+)',
                    r'id[:\s=]+(\w+)'
                ]
                
                for pattern in vmid_patterns:
                    match = re.search(pattern, annotation)
                    if match:
                        vmid = match.group(1)
                        logger.debug(f"VMID found in annotation: {vmid}")
                        break
            
            # Method 4: MobID-ni VMID kimi istifadə et (fallback)
            if not vmid:
                vmid = vm._moId
                logger.debug(f"Using MobID as VMID fallback: {vmid}")
            
            # VMID-ni vm_data-ya əlavə et
            vm_data['vmid'] = vmid
            
            # ... (qalan kod eyni qalır)
            
            # VM Tag'larını əldə et
            raw_tags = self.get_vm_tags_multiple_methods(si, vm, vm._moId)
            
            # Tag'ları emal et
            processed_tags = {}
            for tag in raw_tags:
                category_name = tag.get('category_name')
                tag_name = tag.get('tag_name')

                if category_name and tag_name:
                    processed_tags[category_name] = tag_name

            # Default dəyərləri tətbiq et
            if self.default_site and 'Site' not in processed_tags:
                processed_tags['Site'] = self.default_site
            if self.default_zone and 'Zone' not in processed_tags:
                processed_tags['Zone'] = self.default_zone

            if processed_tags:
                vm_data['tags'] = [processed_tags]

                # Jira Asset tag mapping
                jira_tags = {}
                tag_mapping = {
                    'Systems': 'System',
                    'Zone': 'Zone',
                    'ComponentName': 'Component',
                    'VmEnvironment': 'Environment',
                    'Tribes': 'Tribe',
                    'Squads': 'Squad'
                }

                for original_key, jira_key in tag_mapping.items():
                    if original_key in processed_tags:
                        jira_tags[jira_key] = processed_tags[original_key]

                vm_data['tags_jira_asset'] = [jira_tags] if jira_tags else []
            else:
                vm_data['tags'] = []
                vm_data['tags_jira_asset'] = []
            
            # Hardware məlumatları
            if vm.config and vm.config.hardware:
                vm_data.update({
                    'cpu_count': vm.config.hardware.numCPU,
                    'cpu_cores_per_socket': vm.config.hardware.numCoresPerSocket,
                    'memory_mb': vm.config.hardware.memoryMB,
                    'memory_gb': round(vm.config.hardware.memoryMB / 1024, 2)
                })
            
            # ... (disk, network, guest məlumatları və s.)
            
            logger.info(f"VM {vm.name} extracted with VMID: {vmid}")
            return vm_data
            
        except Exception as e:
            logger.error(f"VM {getattr(vm, 'name', 'Unknown')} məlumat çıxarışı xətası: {e}")
            return None
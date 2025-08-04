"""
Pydantic models for API requests and responses
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
from enum import Enum


class PowerState(str, Enum):
    """VM power state enum"""
    POWERED_ON = "poweredOn"
    POWERED_OFF = "poweredOff"
    SUSPENDED = "suspended"


class GuestState(str, Enum):
    """VM guest state enum"""
    RUNNING = "running"
    NOT_RUNNING = "notRunning"
    UNKNOWN = "unknown"


class DiskInfo(BaseModel):
    """Disk information model"""
    label: str
    capacity_kb: int
    capacity_gb: float
    disk_mode: Optional[str] = None


class NetworkInfo(BaseModel):
    """Network information model"""
    label: str
    mac_address: Optional[str] = None
    connected: Optional[bool] = None
    network_name: Optional[str] = None


class DatastoreInfo(BaseModel):
    """Datastore information model"""
    name: str
    type: str
    capacity_gb: float
    free_space_gb: float


class VMTag(BaseModel):
    """VM tag model"""
    tag_id: str
    tag_name: Optional[str] = None
    tag_description: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_description: Optional[str] = None
    category_cardinality: Optional[str] = None


class VirtualMachine(BaseModel):
    """Virtual Machine model"""
    name: str
    mobid: str
    uuid: Optional[str] = None
    instance_uuid: Optional[str] = None
    power_state: Optional[str] = None
    guest_os: Optional[str] = None
    vm_version: Optional[str] = None
    annotation: Optional[str] = None
    created_date: Optional[datetime] = None
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    
    # Hardware
    cpu_count: Optional[int] = None
    cpu_cores_per_socket: Optional[int] = None
    memory_mb: Optional[int] = None
    memory_gb: Optional[float] = None
    
    # Storage
    disks: List[DiskInfo] = Field(default_factory=list)
    
    # Network
    networks: List[NetworkInfo] = Field(default_factory=list)
    
    # Guest
    guest_state: Optional[str] = None
    guest_os_full_name: Optional[str] = None
    guest_hostname: Optional[str] = None
    tools_status: Optional[str] = None
    tools_version: Optional[str] = None
    ip_address: Optional[str] = None
    guest_ip_addresses: List[str] = Field(default_factory=list)
    
    # Infrastructure
    host_name: Optional[str] = None
    datastores: List[DatastoreInfo] = Field(default_factory=list)
    resource_pool: Optional[str] = None
    folder_name: Optional[str] = None
    
    # Tags
    tags: List[Dict[str, str]] = Field(default_factory=list)
    tags_jira_asset: List[Dict[str, str]] = Field(default_factory=list)

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }


"""
Fixed Jira Virtual Machine model - models.py-də əvəz ediləcək
"""

from pydantic import BaseModel, Field, validator
from typing import List, Dict, Optional, Any, Union
from datetime import datetime


class JiraVirtualMachine(BaseModel):
    """Jira Virtual Machine model - FIXED VERSION"""
    
    # Required fields
    name: str = Field(..., description="VM name")
    
    # Jira specific fields
    jira_object_id: Optional[Union[int, str]] = None
    jira_object_key: Optional[str] = None
    vm_name: Optional[str] = None
    dns_name: Optional[str] = None
    
    # Network
    ip_address: Optional[str] = None
    secondary_ip: Optional[str] = None
    secondary_ip2: Optional[str] = None
    
    # Hardware - FIXED: Accept both int and str, convert safely
    cpu_count: Optional[int] = None
    memory_gb: Optional[Union[int, float]] = None
    memory_mb: Optional[Union[int, float]] = None
    disk_gb: Optional[Union[int, float]] = None
    
    # Infrastructure
    resource_pool: Optional[str] = None
    datastore: Optional[str] = None
    esxi_cluster: Optional[str] = None
    esxi_host: Optional[str] = None
    esxi_port_group: Optional[str] = None
    
    # Management
    site: Optional[str] = None
    description: Optional[str] = None
    jira_ticket: Optional[str] = None
    criticality_level: Optional[str] = None
    created_by: Optional[str] = None
    
    # System
    operating_system: Optional[str] = None
    platform: Optional[str] = None
    kubernetes_cluster: Optional[str] = None
    
    # Backup
    need_backup: Optional[str] = None
    backup_type: Optional[str] = None
    need_monitoring: Optional[str] = None
    
    # Responsible user - FIXED: Accept any dict structure
    responsible_ttl: Optional[Dict[str, Any]] = None
    
    # Tags - FIXED: Accept any list structure
    tags: List[Dict[str, Any]] = Field(default_factory=list)
    tags_jira_asset: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Metadata - FIXED: Accept string dates and convert
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    data_source: str = "jira_asset_management"

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }
        # Allow extra fields that might come from Jira
        extra = "ignore"

    # VALIDATORS - Convert string numbers to proper types
    @validator('cpu_count', pre=True)
    def validate_cpu_count(cls, v):
        if v is None or v == '':
            return None
        try:
            return int(float(str(v)))
        except (ValueError, TypeError):
            return None

    @validator('memory_gb', pre=True)
    def validate_memory_gb(cls, v):
        if v is None or v == '':
            return None
        try:
            return float(str(v))
        except (ValueError, TypeError):
            return None

    @validator('memory_mb', pre=True)
    def validate_memory_mb(cls, v):
        if v is None or v == '':
            return None
        try:
            return float(str(v))
        except (ValueError, TypeError):
            return None

    @validator('disk_gb', pre=True)
    def validate_disk_gb(cls, v):
        if v is None or v == '':
            return None
        try:
            return float(str(v))
        except (ValueError, TypeError):
            return None

    @validator('created_date', 'updated_date', pre=True)
    def validate_dates(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                # Handle different ISO formats
                if v.endswith('Z'):
                    v = v[:-1] + '+00:00'
                return datetime.fromisoformat(v)
            except ValueError:
                try:
                    # Try other common formats
                    return datetime.strptime(v, '%Y-%m-%dT%H:%M:%S.%fZ')
                except ValueError:
                    return None
        return None

    @validator('jira_object_id', pre=True)
    def validate_jira_object_id(cls, v):
        if v is None or v == '':
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return str(v)

    @validator('name', pre=True)
    def validate_name(cls, v):
        # Ensure name is never empty
        if not v or v.strip() == '':
            return "Unknown VM"
        return str(v).strip()

    @validator('tags', 'tags_jira_asset', pre=True)
    def validate_tags(cls, v):
        if not v:
            return []
        if not isinstance(v, list):
            return []
        return v

    @validator('responsible_ttl', pre=True)
    def validate_responsible_ttl(cls, v):
        if not v:
            return None
        if isinstance(v, dict):
            return v
        return None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }


class MissingVM(BaseModel):
    """Missing VM model for VMs in vCenter but not in Jira"""
    vm_name: str
    jira_asset_payload: Dict[str, Any]
    debug_info: Dict[str, Any]
    vm_summary: Dict[str, Any]
    status: str = "pending_creation"
    created_date: datetime = Field(default_factory=datetime.utcnow)
    source: str = "vcenter_diff_processor"

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }


class VCenterConfig(BaseModel):
    """vCenter configuration model"""
    host: str = Field(..., description="vCenter server hostname or IP")
    username: str = Field(..., description="vCenter username")
    password: str = Field(..., description="vCenter password")
    port: int = Field(443, description="vCenter port (default: 443)")


class JiraConfig(BaseModel):
    """Jira configuration model"""
    api_url: str = Field(..., description="Jira Asset Management API URL")
    token: str = Field(..., description="Jira Bearer token")
    object_type_id: str = Field("3191", description="VM Object Type ID")
    object_schema_id: str = Field("242", description="Object Schema ID")
    cookie: Optional[str] = Field(None, description="Session cookie (optional)")


class CollectionRequest(BaseModel):
    """VM collection request model"""
    vcenter_config: Optional[VCenterConfig] = Field(None, description="vCenter connection settings")
    batch_size: Optional[int] = Field(50, ge=1, le=200, description="VMs per batch")
    max_processes: Optional[int] = Field(8, ge=1, le=20, description="Maximum parallel processes")


class JiraCollectionRequest(BaseModel):
    """Jira VM collection request model"""
    jira_config: Optional[JiraConfig] = Field(None, description="Jira connection settings")
    batch_size: Optional[int] = Field(50, ge=1, le=200, description="VMs per batch")
    max_processes: Optional[int] = Field(8, ge=1, le=20, description="Maximum parallel processes")


class DiffProcessRequest(BaseModel):
    """VM diff processing request model"""
    jira_config: Optional[JiraConfig] = Field(None, description="Jira connection settings")


class CollectionResponse(BaseModel):
    """VM collection response model"""
    status: str
    message: str
    task_id: Optional[str] = None
    total_vms: Optional[int] = None
    processed_vms: Optional[int] = None
    errors: Optional[int] = None
    processing_time: Optional[float] = None


class VMListResponse(BaseModel):
    """VM list response model"""
    status: str
    message: str
    total_count: int
    vms: List[VirtualMachine]


class JiraVMListResponse(BaseModel):
    """Jira VM list response model"""
    status: str
    message: str
    total_count: int
    vms: List[JiraVirtualMachine]


class MissingVMListResponse(BaseModel):
    """Missing VM list response model"""
    status: str
    message: str
    total_count: int
    vms: List[MissingVM]


class DeleteResponse(BaseModel):
    """Delete response model"""
    status: str
    message: str
    deleted_count: int


class DiffProcessResponse(BaseModel):
    """Diff process response model"""
    status: str
    message: str
    total_vcenter_vms: Optional[int] = None
    total_jira_vms: Optional[int] = None
    missing_vms_count: Optional[int] = None
    processed_missing_vms: Optional[int] = None
    errors: Optional[int] = None
    processing_time: Optional[float] = None
    object_type_id: Optional[str] = None
    object_schema_id: Optional[str] = None


class BatchResult(BaseModel):
    """Batch processing result model"""
    batch_id: int
    processed: int
    errors: int
    message: str


class ProcessingStatus(BaseModel):
    """Processing status model"""
    task_id: str
    status: str
    progress: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class JiraPosterConfig(BaseModel):
    """Jira Poster configuration model"""
    jira_token: str = Field(..., description="Jira Bearer token for authentication")
    create_url: str = Field(
        "https://jira-support.company.com/rest/insight/1.0/object/create",
        description="Jira Asset API endpoint for creating objects"
    )
    object_type_id: Optional[str] = Field("3191", description="VM Object Type ID in Jira Asset")
    object_schema_id: Optional[str] = Field("242", description="Object Schema ID in Jira Asset")

    delay_seconds: Optional[float] = Field(1.0, ge=0.0, le=10.0, description="Delay between requests")


class JiraPosterRequest(BaseModel):
    """Jira Poster request model"""
    jira_config: Optional[JiraPosterConfig] = Field(None, description="Jira connection settings")
    limit: Optional[int] = Field(None, ge=1, le=1000, description="Maximum VMs to process")
    retry_failed: Optional[bool] = Field(False, description="Retry previously failed VMs")
    max_retries: Optional[int] = Field(3, ge=1, le=10, description="Maximum retry attempts")


class JiraPosterResponse(BaseModel):
    """Jira Poster response model"""
    status: str
    message: str
    processed: int
    successful: int
    failed: int
    processing_time: Optional[float] = None
    results: List[Dict[str, Any]] = Field(default_factory=list)


class CompletedJiraAsset(BaseModel):
    """Completed Jira Asset model - FIXED ObjectId VERSION"""
    vm_name: str
    jira_object_key: Optional[str] = None
    jira_asset_payload: Dict[str, Any] = Field(default_factory=dict)
    vm_summary: Dict[str, Any] = Field(default_factory=dict)
    debug_info: Dict[str, Any] = Field(default_factory=dict)
    
    # Processing info
    status: str = "completed"
    jira_post_date: datetime = Field(default_factory=datetime.utcnow)
    processing_completed: bool = True
    original_id: Optional[str] = None  # ✅ FIXED: Make optional and ensure string
    
    # Jira response
    jira_response: Optional[Dict[str, Any]] = None
    
    # Metadata
    source: str = "jira_asset_poster"
    created_date: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }
    
    # ✅ ADD: Validator to handle ObjectId conversion
    @validator('original_id', pre=True)
    def validate_original_id(cls, v):
        if v is None:
            return None
        # Convert ObjectId to string
        return str(v)
    
    @validator('jira_post_date', 'created_date', pre=True)
    def validate_dates(cls, v):
        if v is None:
            return datetime.utcnow()
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                return datetime.utcnow()
        return datetime.utcnow()


class FailedJiraAsset(BaseModel):
    """Failed Jira Asset model"""
    vm_name: str
    jira_asset_payload: Dict[str, Any]
    vm_summary: Dict[str, Any]
    debug_info: Dict[str, Any]
    
    # Failure info
    status: str = "failed"
    failure_date: datetime = Field(default_factory=datetime.utcnow)
    failure_reason: str
    failure_status_code: Optional[int] = None
    retry_count: int = 0
    last_attempt: datetime = Field(default_factory=datetime.utcnow)
    
    # Original info
    original_id: Optional[str] = None
    source: str = "jira_asset_poster"
    created_date: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }


class JiraPosterStats(BaseModel):
    """Jira Poster statistics model"""
    pending_vms: int
    failed_vms: int
    completed_vms: int
    total_processed: int
    failed_vm_details: List[Dict[str, Any]] = Field(default_factory=list)
    last_check: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }


class CompletedAssetListResponse(BaseModel):
    """Completed asset list response model"""
    status: str
    message: str
    total_count: int
    assets: List[CompletedJiraAsset]


class FailedAssetListResponse(BaseModel):
    """Failed asset list response model"""
    status: str
    message: str
    total_count: int
    assets: List[FailedJiraAsset]


class SelectedVMsPosterRequest(BaseModel):
    """Selected VMs poster request model"""
    jira_config: Optional[JiraPosterConfig] = None
    vm_ids: List[str] = Field(..., description="List of VM IDs to post")
    delay_seconds: Optional[float] = Field(1.0, ge=0.0, le=10.0)
    retry_failed: Optional[bool] = Field(False, description="Retry previously failed VMs")
    max_retries: Optional[int] = Field(3, ge=1, le=10, description="Maximum retry attempts")

class SelectableVM(BaseModel):
    """Selectable VM model with checkbox state"""
    id: str
    vm_name: str
    jira_asset_payload: Dict[str, Any]
    vm_summary: Dict[str, Any]
    debug_info: Optional[Dict[str, Any]] = None
    status: str = "pending_creation"
    created_date: datetime = Field(default_factory=datetime.utcnow)
    selected: bool = False
    can_post: bool = True
    source: str = "vcenter_diff_processor"

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }

class SelectableVMListResponse(BaseModel):
    """Selectable VM list response"""
    status: str
    message: str
    total_count: int
    vms: List[SelectableVM]


# ✅ NEW MODEL: Custom payload request
class CustomPayloadRequest(BaseModel):
    """Custom Jira payload request model"""
    jira_config: Optional[JiraPosterConfig] = None
    payload: Dict[str, Any] = Field(..., description="Custom Jira Asset payload")
    vm_name: Optional[str] = Field("custom-vm", description="VM name for tracking")


# ✅ NEW MODEL: Environment configuration
class EnvironmentConfig(BaseModel):
    """Environment-specific configuration model"""
    environment: str = Field("production", description="Environment name")
    object_type_id: Optional[str] = Field(None, description="Override Object Type ID")
    object_schema_id: Optional[str] = Field(None, description="Override Object Schema ID")
    description: Optional[str] = Field(None, description="Environment description")


# ✅ NEW MODEL: Configuration test request
class ConfigTestRequest(BaseModel):
    """Configuration test request model"""
    jira_config: JiraConfig
    test_object_creation: Optional[bool] = Field(False, description="Test actual object creation")


class ConfigTestResponse(BaseModel):
    """Configuration test response model"""
    status: str
    message: str
    object_type_name: Optional[str] = None
    object_type_id: Optional[str] = None
    schema_id: Optional[str] = None
    config_used: Optional[Dict[str, Any]] = None
    test_results: Optional[Dict[str, Any]] = None
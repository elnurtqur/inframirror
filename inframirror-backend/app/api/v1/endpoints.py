"""
API endpoints for VMware Collector
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from datetime import datetime

from app.models.models import (
    CollectionRequest, 
    CollectionResponse, 
    VMListResponse, 
    DeleteResponse,
    VirtualMachine,
    JiraCollectionRequest,
    JiraVirtualMachine,
    JiraVMListResponse,
    DiffProcessRequest,
    DiffProcessResponse,
    MissingVM,
    MissingVMListResponse,
    SelectedVMsPosterRequest,
    SelectableVM,
    SelectableVMListResponse
)
from app.services.processing_service import ProcessingService
from app.services.jira_processing_service import JiraProcessingService
from app.services.diff_service import DiffService
from app.services.database_service import DatabaseService
from app.utils.utils import create_error_response, create_success_response

from app.services.jira_poster_service import JiraPosterService
from app.models.models import (
    JiraPosterRequest, JiraPosterResponse, JiraPosterStats,
    CompletedJiraAsset, FailedJiraAsset, CompletedAssetListResponse, FailedAssetListResponse
)
from app.core.database import get_async_collection, get_sync_collection  # Add this line
from app.core.config import settings  # Add this line


logger = logging.getLogger(__name__)

router = APIRouter()

# Service instances
processing_service = ProcessingService()
jira_processing_service = JiraProcessingService()
diff_service = DiffService()
database_service = DatabaseService()


@router.post("/collect-vms", response_model=CollectionResponse)
async def collect_vms(
    background_tasks: BackgroundTasks,
    request: CollectionRequest = CollectionRequest()
):
    """
    Collect VMs from vCenter and write to database
    """
    try:
        logger.info("VM collection started")
        
        # Extract vCenter configuration from request
        vcenter_config = None
        if request.vcenter_config:
            vcenter_config = {
                'host': request.vcenter_config.host,
                'username': request.vcenter_config.username,
                'password': request.vcenter_config.password,
                'port': request.vcenter_config.port
            }
            default_site = request.vcenter_config.default_site
            default_zone = request.vcenter_config.default_zone
        
        if default_site or default_zone:
            logger.info(f"Default dəyərlər konfiqurasyonu - Site: {default_site}, Zone: {default_zone}")

        # Background task function
        def run_collection():
            return processing_service.collect_vms(
                vcenter_host=vcenter_config['host'] if vcenter_config else None,
                vcenter_username=vcenter_config['username'] if vcenter_config else None,
                vcenter_password=vcenter_config['password'] if vcenter_config else None,
                vcenter_port=vcenter_config['port'] if vcenter_config else None,
                default_site=default_site,
                default_zone=default_zone,
                batch_size=request.batch_size,
                max_processes=request.max_processes
            )
        
        # Run immediately (sync)
        result = run_collection()
        
        if result['status'] == 'success':
            response_message = result['message']
            if result.get('default_applied', 0) > 0:
                response_message += f" ({result['default_applied']} VM-ə default dəyərlər tətbiq edildi)"
            return CollectionResponse(
                status="success",
                message=result['message'],
                total_vms=result['total_vms'],
                processed_vms=result['processed_vms'],
                errors=result['errors'],
                processing_time=result['processing_time']
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=result['message']
            )
            
    except Exception as e:
        logger.error(f"VM collection error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"VM collection error: {str(e)}"
        )


@router.post("/collect-vms-async", response_model=CollectionResponse)
async def collect_vms_async(
    background_tasks: BackgroundTasks,
    request: CollectionRequest = CollectionRequest()
):
    """
    Collect VMs from vCenter (async) - as background task
    """
    try:
        logger.info("VM collection (async) started")
        
        # Extract vCenter configuration from request
        vcenter_config = None
        if request.vcenter_config:
            vcenter_config = {
                'host': request.vcenter_config.host,
                'username': request.vcenter_config.username,
                'password': request.vcenter_config.password,
                'port': request.vcenter_config.port
            }
            default_site = request.vcenter_config.default_site
            default_zone = request.vcenter_config.default_zone

        if default_site or default_zone:
            logger.info(f"Async collection - Default dəyərlər: Site={default_site}, Zone={default_zone}")
        # Add as background task
        background_tasks.add_task(
            processing_service.collect_vms,
            vcenter_config['host'] if vcenter_config else None,
            vcenter_config['username'] if vcenter_config else None,
            vcenter_config['password'] if vcenter_config else None,
            vcenter_config['port'] if vcenter_config else None,
            default_site,
            default_zone,
            request.batch_size,
            request.max_processes
        )
        
        return CollectionResponse(
            status="accepted",
            message="VM collection background task started. Check logs for progress."
        )
            
    except Exception as e:
        logger.error(f"VM collection async error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"VM collection async error: {str(e)}"
        )


@router.post("/collect-jira-vms", response_model=CollectionResponse)
async def collect_jira_vms(
    background_tasks: BackgroundTasks,
    request: JiraCollectionRequest = JiraCollectionRequest()
):
    """
    Collect VMs from Jira Asset Management and write to database
    """
    try:
        logger.info("Jira VM collection started")
        
        # Extract Jira configuration from request
        jira_config = None
        if request.jira_config:
            jira_config = {
                'api_url': request.jira_config.api_url,
                'token': request.jira_config.token,
                'object_type_id': request.jira_config.object_type_id,
                'object_schema_id': request.jira_config.object_schema_id,
                'cookie': request.jira_config.cookie or ''
            }
        
        # Background task function
        def run_jira_collection():
            return jira_processing_service.collect_jira_vms(
                api_url=jira_config['api_url'] if jira_config else None,
                token=jira_config['token'] if jira_config else None,
                object_type_id=jira_config['object_type_id'] if jira_config else None,
                object_schema_id=jira_config['object_schema_id'] if jira_config else None,
                cookie=jira_config['cookie'] if jira_config else None,
                batch_size=request.batch_size,
                max_processes=request.max_processes
            )
        
        # Run immediately (sync)
        result = run_jira_collection()
        
        if result['status'] == 'success':
            return CollectionResponse(
                status="success",
                message=result['message'],
                total_vms=result['total_vms'],
                processed_vms=result['processed_vms'],
                errors=result['errors'],
                processing_time=result['processing_time']
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=result['message']
            )
            
    except Exception as e:
        logger.error(f"Jira VM collection error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Jira VM collection error: {str(e)}"
        )


@router.post("/collect-jira-vms-async", response_model=CollectionResponse)
async def collect_jira_vms_async(
    background_tasks: BackgroundTasks,
    request: JiraCollectionRequest = JiraCollectionRequest()
):
    """
    Collect VMs from Jira Asset Management (async) - as background task
    """
    try:
        logger.info("Jira VM collection (async) started")
        
        # Extract Jira configuration from request
        jira_config = None
        if request.jira_config:
            jira_config = {
                'api_url': request.jira_config.api_url,
                'token': request.jira_config.token,
                'object_type_id': request.jira_config.object_type_id,
                'object_schema_id': request.jira_config.object_schema_id,
                'cookie': request.jira_config.cookie or ''
            }
        
        # Add as background task
        background_tasks.add_task(
            jira_processing_service.collect_jira_vms,
            jira_config['api_url'] if jira_config else None,
            jira_config['token'] if jira_config else None,
            jira_config['object_type_id'] if jira_config else None,
            jira_config['object_schema_id'] if jira_config else None,
            jira_config['cookie'] if jira_config else None,
            request.batch_size,
            request.max_processes
        )
        
        return CollectionResponse(
            status="accepted",
            message="Jira VM collection background task started. Check logs for progress."
        )
            
    except Exception as e:
        logger.error(f"Jira VM collection async error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Jira VM collection async error: {str(e)}"
        )


@router.post("/process-vm-diff", response_model=DiffProcessResponse)
async def process_vm_diff(
    background_tasks: BackgroundTasks,
    request: DiffProcessRequest = DiffProcessRequest()
):
    """
    Process VM diff between vCenter and Jira - with DYNAMIC SCHEMA support
    """
    try:
        logger.info("VM diff processing started")
        
        # ✅ EXTRACT DYNAMIC CONFIGURATION
        jira_config = None
        if request.jira_config:
            jira_config = {
                'api_url': request.jira_config.api_url,
                'token': request.jira_config.token,
                'object_type_id': request.jira_config.object_type_id,      # ✅ DYNAMIC
                'object_schema_id': request.jira_config.object_schema_id,  # ✅ DYNAMIC
                'cookie': request.jira_config.cookie or ''
            }
        
        # Background task function
        def run_diff_process():
            return diff_service.process_vm_diff(
                api_url=jira_config['api_url'] if jira_config else None,
                token=jira_config['token'] if jira_config else None,
                object_type_id=jira_config['object_type_id'] if jira_config else None,      # ✅ PASS DYNAMIC VALUE
                object_schema_id=jira_config['object_schema_id'] if jira_config else None,  # ✅ PASS DYNAMIC VALUE
                cookie=jira_config['cookie'] if jira_config else None
            )
        
        # Run immediately (sync)
        result = run_diff_process()
        
        if result['status'] == 'success':
            return DiffProcessResponse(
                status="success",
                message=result['message'],
                total_vcenter_vms=result.get('total_vcenter_vms'),
                total_jira_vms=result.get('total_jira_vms'),
                missing_vms_count=result['missing_vms_count'],
                processed_missing_vms=result['processed_missing_vms'],
                errors=result['errors'],
                processing_time=result['processing_time'],
                object_type_id=result.get('object_type_id'),      # ✅ RETURN USED VALUES
                object_schema_id=result.get('object_schema_id')   # ✅ RETURN USED VALUES
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=result['message']
            )
            
    except Exception as e:
        logger.error(f"VM diff processing error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"VM diff processing error: {str(e)}"
        )


# ✅ NEW ENDPOINT: Custom payload posting
@router.post("/post-custom-payload-to-jira")
async def post_custom_payload_to_jira(
    payload_request: dict  # ✅ ACCEPT ARBITRARY JSON
):
    """
    Post custom Jira Asset payload directly
    
    Example payload:
    {
        "jira_config": {
            "jira_token": "your_token",
            "create_url": "https://jira.../object/create"
        },
        "payload": {
            "objectTypeId": "3191",
            "objectSchemaId": "242",
            "attributes": [...]
        }
    }
    """
    try:
        logger.info("Custom payload posting started")
        
        # Extract configuration and payload
        jira_config = payload_request.get('jira_config', {})
        custom_payload = payload_request.get('payload', {})
        
        if not custom_payload:
            raise HTTPException(status_code=400, detail="No payload provided")
        
        # Create Jira Poster service
        poster_service = JiraPosterService(
            jira_token=jira_config.get('jira_token'),
            create_url=jira_config.get('create_url')
        )
        
        # Create fake VM document for processing
        fake_vm_doc = {
            'vm_name': custom_payload.get('vm_name', 'custom-payload-vm'),
            'jira_asset_payload': custom_payload
        }
        
        # Post to Jira
        result = poster_service.post_vm_to_jira(fake_vm_doc)
        
        return {
            'status': 'success' if result['success'] else 'failed',
            'message': f"Custom payload posted: {result.get('object_key', 'Failed')}",
            'result': result
        }
        
    except Exception as e:
        logger.error(f"Custom payload posting error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Custom payload posting error: {str(e)}"
        )


# ✅ NEW ENDPOINT: Dynamic configuration testing
@router.post("/test-jira-config")
async def test_jira_config(
    config_request: dict
):
    """
    Test Jira configuration with custom object type and schema
    
    Example:
    {
        "jira_config": {
            "api_url": "https://jira.../object/navlist/iql",
            "token": "your_token",
            "object_type_id": "3191", 
            "object_schema_id": "242"
        }
    }
    """
    try:
        jira_config = config_request.get('jira_config', {})
        
        # Create test service
        jira_service = JiraService(
            api_url=jira_config.get('api_url'),
            token=jira_config.get('token'),
            object_type_id=jira_config.get('object_type_id'),
            object_schema_id=jira_config.get('object_schema_id')
        )
        
        # Test schema access
        session = jira_service.get_session()
        if not session:
            return {'status': 'failed', 'message': 'Authentication failed'}
        
        # Test object type access
        object_type_url = f"https://jira-support.company.com/rest/insight/1.0/objecttype/{jira_config.get('object_type_id')}"
        response = session.get(object_type_url)
        
        if response.status_code == 200:
            obj_type_data = response.json()
            return {
                'status': 'success',
                'message': 'Configuration valid',
                'object_type_name': obj_type_data.get('name'),
                'object_type_id': obj_type_data.get('id'),
                'schema_id': obj_type_data.get('objectSchemaId'),
                'config_used': jira_config
            }
        else:
            return {
                'status': 'failed',
                'message': f'Object Type access failed: {response.status_code}',
                'config_used': jira_config
            }
            
    except Exception as e:
        logger.error(f"Config test error: {e}")
        return {
            'status': 'error',
            'message': f'Config test error: {str(e)}'
        }


# ✅ NEW ENDPOINT: Environment-based configuration
@router.post("/process-vm-diff-env")
async def process_vm_diff_for_environment(
    environment: str = "production",  # ✅ ENVIRONMENT PARAMETER
    object_type_id: Optional[str] = None,
    object_schema_id: Optional[str] = None
):
    """
    Process VM diff for specific environment with predefined configurations
    
    Environments:
    - production: objectTypeId=3191, objectSchemaId=242
    - staging: objectTypeId=3192, objectSchemaId=243  
    - development: objectTypeId=3193, objectSchemaId=244
    """
    
    # ✅ PREDEFINED ENVIRONMENT CONFIGURATIONS
    env_configs = {
        "production": {
            "object_type_id": "3191",
            "object_schema_id": "242"
        },
        "staging": {
            "object_type_id": "3192", 
            "object_schema_id": "243"
        },
        "development": {
            "object_type_id": "3193",
            "object_schema_id": "244"
        }
    }
    
    try:
        # Get environment config or use overrides
        env_config = env_configs.get(environment, env_configs["production"])
        
        final_object_type_id = object_type_id or env_config["object_type_id"]
        final_object_schema_id = object_schema_id or env_config["object_schema_id"]
        
        logger.info(f"Processing VM diff for environment: {environment}")
        logger.info(f"Using Object Type ID: {final_object_type_id}")
        logger.info(f"Using Object Schema ID: {final_object_schema_id}")
        
        # Process with environment-specific configuration
        result = diff_service.process_vm_diff(
            object_type_id=final_object_type_id,
            object_schema_id=final_object_schema_id
        )
        
        return {
            'status': result['status'],
            'message': f"Environment '{environment}' processing: {result['message']}",
            'environment': environment,
            'object_type_id': final_object_type_id,
            'object_schema_id': final_object_schema_id,
            'result': result
        }
        
    except Exception as e:
        logger.error(f"Environment VM diff error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Environment VM diff error: {str(e)}"
        )


@router.post("/process-vm-diff-async", response_model=DiffProcessResponse)
async def process_vm_diff_async(
    background_tasks: BackgroundTasks,
    request: DiffProcessRequest = DiffProcessRequest()
):
    """
    Process VM diff between vCenter and Jira (async) - as background task
    """
    try:
        logger.info("VM diff processing (async) started")
        
        # Extract Jira configuration from request
        jira_config = None
        if request.jira_config:
            jira_config = {
                'api_url': request.jira_config.api_url,
                'token': request.jira_config.token,
                'object_type_id': request.jira_config.object_type_id,
                'object_schema_id': request.jira_config.object_schema_id,
                'cookie': request.jira_config.cookie or ''
            }
        
        # Add as background task
        background_tasks.add_task(
            diff_service.process_vm_diff,
            jira_config['api_url'] if jira_config else None,
            jira_config['token'] if jira_config else None,
            jira_config['object_type_id'] if jira_config else None,
            jira_config['object_schema_id'] if jira_config else None,
            jira_config['cookie'] if jira_config else None
        )
        
        return DiffProcessResponse(
            status="accepted",
            message="VM diff processing background task started. Check logs for progress."
        )
            
    except Exception as e:
        logger.error(f"VM diff processing async error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"VM diff processing async error: {str(e)}"
        )


@router.get("/get-all-vms-from-db", response_model=VMListResponse)
async def get_all_vms_from_db(
    skip: int = Query(0, ge=0, description="Number of VMs to skip"),
    limit: int = Query(1000, ge=1, le=5000, description="Maximum number of VMs"),
    search: Optional[str] = Query(None, description="Search query"),
    tag_category: Optional[str] = Query(None, description="Tag category"),
    tag_value: Optional[str] = Query(None, description="Tag value")
):
    """
    Get all VMs from database (vCenter collection)
    """
    try:
        logger.info(f"Retrieving VMs from database (skip={skip}, limit={limit})")
        
        # Based on search parameters
        if search:
            vms = await database_service.search_vms(search, limit)
            total_count = len(vms)  # Exact count is difficult for search
        elif tag_category and tag_value:
            vms = await database_service.get_vms_by_tag(tag_category, tag_value, limit)
            total_count = len(vms)
        else:
            vms = await database_service.get_all_vms(skip, limit)
            total_count = await database_service.get_vm_count()
        
        # Convert to Pydantic models
        vm_models = []
        for vm_data in vms:
            try:
                vm_model = VirtualMachine(**vm_data)
                vm_models.append(vm_model)
            except Exception as e:
                logger.warning(f"VM model conversion error: {e}")
                continue
        
        logger.info(f"Retrieved {len(vm_models)} VMs")
        
        return VMListResponse(
            status="success",
            message=f"Retrieved {len(vm_models)} VMs",
            total_count=total_count,
            vms=vm_models
        )
        
    except Exception as e:
        logger.error(f"Error retrieving VMs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving VMs: {str(e)}"
        )




@router.get("/get-all-missing-vms-from-db", response_model=MissingVMListResponse)
async def get_all_missing_vms_from_db(
    skip: int = Query(0, ge=0, description="Number of VMs to skip"),
    limit: int = Query(1000, ge=1, le=5000, description="Maximum number of VMs")
):
    """
    Get all missing VMs from database - ENHANCED WITH VMID SUPPORT
    """
    try:
        logger.info(f"Retrieving missing VMs from database (skip={skip}, limit={limit})")
        
        vms = await database_service.get_all_missing_vms(skip, limit)
        total_count = await database_service.get_missing_vm_count()
        
        # Convert to Pydantic models with VMID extraction
        vm_models = []
        vmid_found_count = 0
        
        for vm_data in vms:
            try:
                # ✅ Extract VMID from missing VM data
                vmid_value = None
                
                # Check multiple sources for VMID
                vmid_sources = [
                    # From vm_summary
                    vm_data.get('vm_summary', {}).get('vmid'),
                    vm_data.get('vm_summary', {}).get('VMID'),
                    vm_data.get('vm_summary', {}).get('vm_id'),
                    # From debug_info
                    vm_data.get('debug_info', {}).get('vmid'),
                    vm_data.get('debug_info', {}).get('VMID'),
                    vm_data.get('debug_info', {}).get('vcenter_vmid'),
                    vm_data.get('debug_info', {}).get('vcenter_mobid'),
                    # Direct from root level
                    vm_data.get('vmid'),
                    vm_data.get('VMID'),
                    vm_data.get('vm_id')
                ]
                
                for source_value in vmid_sources:
                    if source_value and str(source_value).strip():
                        vmid_value = str(source_value).strip()
                        vmid_found_count += 1
                        logger.debug(f"Missing VM {vm_data.get('vm_name', 'Unknown')}: VMID = {vmid_value}")
                        break
                
                if not vmid_value:
                    logger.debug(f"Missing VM {vm_data.get('vm_name', 'Unknown')}: No VMID found")
                
                # ✅ Create MissingVM model with VMID
                vm_model = MissingVM(
                    vm_name=vm_data.get('vm_name', 'Unknown'),
                    vmid=vmid_value,
                    VMID=vmid_value,
                    vm_id=vmid_value,
                    jira_asset_payload=vm_data.get('jira_asset_payload', {}),
                    debug_info=vm_data.get('debug_info', {}),
                    vm_summary=vm_data.get('vm_summary', {}),
                    status=vm_data.get('status', 'pending_creation'),
                    created_date=vm_data.get('created_date', datetime.utcnow()),
                    source=vm_data.get('source', 'vcenter_diff_processor')
                )
                vm_models.append(vm_model)
                
            except Exception as e:
                logger.warning(f"Missing VM model conversion error: {e}")
                logger.debug(f"Failed missing VM data: {vm_data}")
                continue
        
        logger.info(f"Retrieved {len(vm_models)} missing VMs")
        logger.info(f"Missing VMs with VMID: {vmid_found_count}/{len(vm_models)} ({vmid_found_count/len(vm_models)*100 if len(vm_models) > 0 else 0:.1f}%)")
        
        # Enhanced response message
        response_message = f"Retrieved {len(vm_models)} missing VMs"
        if vmid_found_count > 0:
            response_message += f" ({vmid_found_count} with VMID)"
        
        return MissingVMListResponse(
            status="success",
            message=response_message,
            total_count=total_count,
            vms=vm_models
        )
        
    except Exception as e:
        logger.error(f"Error retrieving missing VMs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving missing VMs: {str(e)}"
        )


@router.delete("/delete-all-vms-from-db", response_model=DeleteResponse)
async def delete_all_vms_from_db():
    """
    Delete all VMs from database (vCenter collection)
    """
    try:
        logger.info("Deleting all VMs...")
        
        deleted_count = await database_service.delete_all_vms()
        
        logger.info(f"Deleted {deleted_count} VMs")
        
        return DeleteResponse(
            status="success",
            message=f"Successfully deleted {deleted_count} VMs",
            deleted_count=deleted_count
        )
        
    except Exception as e:
        logger.error(f"Error deleting VMs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting VMs: {str(e)}"
        )


@router.delete("/delete-all-jira-vms-from-db", response_model=DeleteResponse)
async def delete_all_jira_vms_from_db():
    """
    Delete all Jira VMs from database
    """
    try:
        logger.info("Deleting all Jira VMs...")
        
        deleted_count = await database_service.delete_all_jira_vms()
        
        logger.info(f"Deleted {deleted_count} Jira VMs")
        
        return DeleteResponse(
            status="success",
            message=f"Successfully deleted {deleted_count} Jira VMs",
            deleted_count=deleted_count
        )
        
    except Exception as e:
        logger.error(f"Error deleting Jira VMs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting Jira VMs: {str(e)}"
        )


@router.delete("/delete-all-missing-vms-from-db", response_model=DeleteResponse)
async def delete_all_missing_vms_from_db():
    """
    Delete all missing VMs from database
    """
    try:
        logger.info("Deleting all missing VMs...")
        
        deleted_count = await database_service.delete_all_missing_vms()
        
        logger.info(f"Deleted {deleted_count} missing VMs")
        
        return DeleteResponse(
            status="success",
            message=f"Successfully deleted {deleted_count} missing VMs",
            deleted_count=deleted_count
        )
        
    except Exception as e:
        logger.error(f"Error deleting missing VMs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting missing VMs: {str(e)}"
        )


@router.get("/vm/{identifier}")
async def get_vm_by_identifier(identifier: str):
    """
    Get single VM by UUID or vmid
    """
    try:
        # First try UUID
        vm = await database_service.get_vm_by_uuid(identifier)
        
        # If not found by UUID, try vmid
        if not vm:
            vm = await database_service.get_vm_by_vmid(identifier)
        
        if not vm:
            raise HTTPException(
                status_code=404,
                detail=f"VM not found: {identifier}"
            )
        
        # Convert to Pydantic model
        vm_model = VirtualMachine(**vm)
        
        return create_success_response(
            data=vm_model,
            message="VM found successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VM search error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"VM search error: {str(e)}"
        )


@router.get("/statistics")
async def get_vm_statistics():
    """
    Get VM statistics
    """
    try:
        stats = await database_service.get_vm_statistics()
        
        return create_success_response(
            data=stats,
            message="Statistics retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Statistics error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Statistics error: {str(e)}"
        )


@router.get("/jira-statistics")
async def get_jira_vm_statistics():
    """
    Get Jira VM statistics
    """
    try:
        stats = await database_service.get_jira_vm_statistics()
        
        return create_success_response(
            data=stats,
            message="Jira VM statistics retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Jira VM statistics error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Jira VM statistics error: {str(e)}"
        )


@router.get("/collection-status")
async def get_collection_status():
    """
    Get collection status
    """
    try:
        vcenter_status = await processing_service.get_collection_status()
        jira_status = await jira_processing_service.get_jira_collection_status()
        missing_vm_count = await database_service.get_missing_vm_count()
        
        combined_status = {
            'vcenter': vcenter_status,
            'jira': jira_status,
            'missing_vms_count': missing_vm_count
        }
        
        return create_success_response(
            data=combined_status,
            message="Collection status retrieved"
        )
        
    except Exception as e:
        logger.error(f"Collection status error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Collection status error: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """
    Health check endpoint
    """
    try:
        # Check database connection
        vm_count = await database_service.get_vm_count()
        jira_vm_count = await database_service.get_jira_vm_count()
        missing_vm_count = await database_service.get_missing_vm_count()
        
        return {
            "status": "healthy",
            "database": "connected",
            "vcenter_vm_count": vm_count,
            "jira_vm_count": jira_vm_count,
            "missing_vm_count": missing_vm_count,
            "timestamp": "2024-01-01T00:00:00Z"
        }
        
    except Exception as e:
        logger.error(f"Health check error: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e)
            }
        )
    
@router.post("/post-to-jira", response_model=JiraPosterResponse)
async def post_vms_to_jira(
    background_tasks: BackgroundTasks,
    request: JiraPosterRequest = JiraPosterRequest()
):
    """
    Post missing VMs to Jira Asset Management
    
    This endpoint takes VMs from the missing_vms_for_jira collection
    and creates them as assets in Jira Asset Management system.
    """
    try:
        logger.info("Jira Asset posting started")
        
        # Extract Jira configuration from request
        jira_config = {}
        if request.jira_config:
            jira_config = {
                'jira_token': request.jira_config.jira_token,
                'create_url': request.jira_config.create_url,
                'delay_seconds': request.jira_config.delay_seconds or 1.0
            }
        
        # Create Jira Poster service
        poster_service = JiraPosterService(
            jira_token=jira_config.get('jira_token'),
            create_url=jira_config.get('create_url')
        )
        
        # Handle retry failed VMs if requested
        if request.retry_failed:
            logger.info("Retrying failed VMs first...")
            retry_result = poster_service.retry_failed_vms(request.max_retries or 3)
            logger.info(f"Retry result: {retry_result.get('message', 'Completed')}")
        
        # Process VMs
        result = poster_service.process_vms(
            limit=request.limit,
            delay=jira_config.get('delay_seconds', 1.0)
        )
        
        if result['status'] == 'success':
            return JiraPosterResponse(
                status="success",
                message=f"{result['successful']} VMs posted successfully to Jira, {result['failed']} failed",
                processed=result['processed'],
                successful=result['successful'],
                failed=result['failed'],
                processing_time=result.get('processing_time'),
                results=result.get('results', [])
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get('message', 'Unknown error occurred')
            )
            
    except Exception as e:
        logger.error(f"Jira Asset posting error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Jira Asset posting error: {str(e)}"
        )


@router.post("/post-to-jira-async", response_model=JiraPosterResponse)
async def post_vms_to_jira_async(
    background_tasks: BackgroundTasks,
    request: JiraPosterRequest = JiraPosterRequest()
):
    """
    Post missing VMs to Jira Asset Management (async background task)
    """
    try:
        logger.info("Jira Asset posting (async) started")
        
        # Extract configuration
        jira_config = {}
        if request.jira_config:
            jira_config = {
                'jira_token': request.jira_config.jira_token,
                'create_url': request.jira_config.create_url,
                'delay_seconds': request.jira_config.delay_seconds or 1.0
            }
        
        # Add as background task
        def run_jira_posting():
            poster_service = JiraPosterService(
                jira_token=jira_config.get('jira_token'),
                create_url=jira_config.get('create_url')
            )
            
            if request.retry_failed:
                poster_service.retry_failed_vms(request.max_retries or 3)
            
            return poster_service.process_vms(
                limit=request.limit,
                delay=jira_config.get('delay_seconds', 1.0)
            )
        
        background_tasks.add_task(run_jira_posting)
        
        return JiraPosterResponse(
            status="accepted",
            message="Jira Asset posting background task started. Check logs for progress.",
            processed=0,
            successful=0,
            failed=0
        )
            
    except Exception as e:
        logger.error(f"Jira Asset posting async error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Jira Asset posting async error: {str(e)}"
        )


@router.get("/jira-poster-stats", response_model=JiraPosterStats)
async def get_jira_poster_stats():
    """
    Get statistics about Jira Asset posting process
    
    Returns counts of pending, failed, and completed VM postings.
    """
    try:
        poster_service = JiraPosterService()
        stats = poster_service.get_processing_stats()
        
        return JiraPosterStats(
            pending_vms=stats.get('pending_vms', 0),
            failed_vms=stats.get('failed_vms', 0),
            completed_vms=stats.get('completed_vms', 0),
            total_processed=stats.get('total_processed', 0),
            failed_vm_details=stats.get('failed_vm_details', []),
            last_check=stats.get('last_check', datetime.utcnow())
        )
        
    except Exception as e:
        logger.error(f"Error getting Jira poster stats: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting Jira poster stats: {str(e)}"
        )


@router.get("/completed-jira-assets", response_model=CompletedAssetListResponse)
async def get_completed_jira_assets(
    skip: int = Query(0, ge=0, description="Number of assets to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of assets")
):
    """
    Get successfully completed Jira Asset creations - FIXED ObjectId VERSION
    """
    try:
        logger.info(f"Retrieving completed Jira assets (skip={skip}, limit={limit})")
        
        # Direct database access
        vcenter_collection = await get_async_collection()
        client = vcenter_collection.database.client
        completed_collection = client[settings.mongodb_database]['completed_jira_assets']
        
        # Get total count
        total_count = await completed_collection.count_documents({})
        logger.info(f"Total completed assets in DB: {total_count}")
        
        if total_count == 0:
            return CompletedAssetListResponse(
                status="success",
                message="No completed assets found",
                total_count=0,
                assets=[]
            )
        
        # Get assets
        cursor = completed_collection.find({}).skip(skip).limit(limit).sort('jira_post_date', -1)
        raw_assets = await cursor.to_list(length=limit)
        
        logger.info(f"Raw assets retrieved: {len(raw_assets)}")
        
        # Convert to Pydantic models with ObjectId handling
        asset_models = []
        for asset_data in raw_assets:
            try:
                # ✅ FIX: Convert ObjectId fields to strings
                if '_id' in asset_data:
                    del asset_data['_id']
                
                # ✅ CRITICAL FIX: Convert original_id ObjectId to string
                if 'original_id' in asset_data and asset_data['original_id']:
                    if hasattr(asset_data['original_id'], '__str__'):
                        asset_data['original_id'] = str(asset_data['original_id'])
                
                # ✅ FIX: Handle any other ObjectId fields
                for key, value in asset_data.items():
                    if hasattr(value, '__class__') and 'ObjectId' in str(type(value)):
                        asset_data[key] = str(value)
                
                # ✅ FIX: Ensure dates are proper datetime objects
                date_fields = ['jira_post_date', 'created_date']
                for date_field in date_fields:
                    if date_field not in asset_data or asset_data[date_field] is None:
                        asset_data[date_field] = datetime.utcnow()
                
                # ✅ FIX: Ensure required fields exist with defaults
                required_defaults = {
                    'vm_name': 'Unknown',
                    'jira_asset_payload': {},
                    'vm_summary': {},
                    'debug_info': {},
                    'status': 'completed',
                    'processing_completed': True,
                    'source': 'jira_asset_poster',
                    'original_id': '',
                    'jira_object_key': None,
                    'jira_response': None
                }
                
                for field, default_value in required_defaults.items():
                    if field not in asset_data:
                        asset_data[field] = default_value
                
                logger.debug(f"Processing asset: {asset_data.get('vm_name')} (original_id: {asset_data.get('original_id')})")
                
                # Create CompletedJiraAsset model
                asset_model = CompletedJiraAsset(**asset_data)
                asset_models.append(asset_model)
                
            except Exception as e:
                logger.warning(f"Completed asset model conversion error: {e}")
                logger.debug(f"Failed asset data keys: {list(asset_data.keys())}")
                logger.debug(f"original_id type: {type(asset_data.get('original_id'))}")
                continue
        
        logger.info(f"Successfully converted {len(asset_models)} completed assets")
        
        return CompletedAssetListResponse(
            status="success",
            message=f"Retrieved {len(asset_models)} completed assets",
            total_count=total_count,
            assets=asset_models
        )
        
    except Exception as e:
        logger.error(f"Error retrieving completed assets: {e}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving completed assets: {str(e)}"
        )


@router.get("/failed-jira-assets", response_model=FailedAssetListResponse)
async def get_failed_jira_assets(
    skip: int = Query(0, ge=0, description="Number of assets to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of assets")
):
    """
    Get failed Jira Asset creation attempts
    """
    try:
        logger.info(f"Retrieving failed Jira assets (skip={skip}, limit={limit})")
        
        # Get database service for failed assets
        poster_service = JiraPosterService()
        poster_service.get_collections()
        
        # Get failed assets
        cursor = poster_service.missing_collection.find({'status': 'failed'}).skip(skip).limit(limit).sort('failure_date', -1)
        assets = list(cursor)
        
        # Get total count
        total_count = poster_service.missing_collection.count_documents({'status': 'failed'})
        
        # Convert to Pydantic models
        asset_models = []
        for asset_data in assets:
            try:
                # Remove MongoDB _id field
                if '_id' in asset_data:
                    del asset_data['_id']
                
                # Create FailedJiraAsset model
                failed_asset = FailedJiraAsset(
                    vm_name=asset_data.get('vm_name', 'Unknown'),
                    jira_asset_payload=asset_data.get('jira_asset_payload', {}),
                    vm_summary=asset_data.get('vm_summary', {}),
                    debug_info=asset_data.get('debug_info', {}),
                    failure_reason=asset_data.get('failure_reason', 'Unknown error'),
                    failure_status_code=asset_data.get('failure_status_code'),
                    retry_count=asset_data.get('retry_count', 0),
                    failure_date=asset_data.get('failure_date', datetime.utcnow()),
                    last_attempt=asset_data.get('last_attempt', datetime.utcnow()),
                    original_id=str(asset_data.get('original_id', '')),
                    created_date=asset_data.get('created_date', datetime.utcnow())
                )
                asset_models.append(failed_asset)
            except Exception as e:
                logger.warning(f"Failed asset model conversion error: {e}")
                continue
        
        logger.info(f"Retrieved {len(asset_models)} failed assets")
        
        return FailedAssetListResponse(
            status="success",
            message=f"Retrieved {len(asset_models)} failed assets",
            total_count=total_count,
            assets=asset_models
        )
        
    except Exception as e:
        logger.error(f"Error retrieving failed assets: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving failed assets: {str(e)}"
        )


@router.post("/retry-failed-jira-posts", response_model=JiraPosterResponse)
async def retry_failed_jira_posts(
    background_tasks: BackgroundTasks,
    max_retries: int = Query(3, ge=1, le=10, description="Maximum retry attempts"),
    jira_token: Optional[str] = Query(None, description="Jira Bearer token"),
    create_url: Optional[str] = Query(None, description="Jira Asset create URL")
):
    """
    Retry failed Jira Asset postings
    
    This endpoint retries VMs that previously failed to post to Jira,
    up to the specified maximum retry count.
    """
    try:
        logger.info(f"Retrying failed Jira posts (max_retries={max_retries})")
        
        # Create Jira Poster service
        poster_service = JiraPosterService(
            jira_token=jira_token,
            create_url=create_url
        )
        
        # Retry failed VMs
        result = poster_service.retry_failed_vms(max_retries)
        
        if result['status'] == 'success':
            return JiraPosterResponse(
                status="success",
                message=result.get('message', 'Retry completed'),
                processed=result.get('processed', 0),
                successful=result.get('successful', 0),
                failed=result.get('failed', 0),
                processing_time=result.get('processing_time'),
                results=result.get('results', [])
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get('message', 'Retry failed')
            )
            
    except Exception as e:
        logger.error(f"Retry failed posts error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Retry failed posts error: {str(e)}"
        )


@router.delete("/delete-completed-jira-assets", response_model=DeleteResponse)
async def delete_completed_jira_assets():
    """
    Delete all completed Jira Asset records
    """
    try:
        logger.info("Deleting completed Jira assets...")
        
        poster_service = JiraPosterService()
        poster_service.get_collections()
        
        result = poster_service.completed_collection.delete_many({})
        deleted_count = result.deleted_count
        
        logger.info(f"Deleted {deleted_count} completed Jira assets")
        
        return DeleteResponse(
            status="success",
            message=f"Successfully deleted {deleted_count} completed Jira assets",
            deleted_count=deleted_count
        )
        
    except Exception as e:
        logger.error(f"Error deleting completed assets: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting completed assets: {str(e)}"
        )


# File: app/api/v1/endpoints.py 
# REPLACE the entire get_all_jira_vms_from_db method with this:

@router.get("/get-all-jira-vms-from-db", response_model=JiraVMListResponse)
async def get_all_jira_vms_from_db(
    skip: int = Query(0, ge=0, description="Number of VMs to skip"),
    limit: int = Query(1000, ge=1, le=5000, description="Maximum number of VMs")
):
    """
    Get all Jira VMs from database - FIXED VMID FIELD MAPPING
    """
    try:
        logger.info(f"Retrieving Jira VMs from database (skip={skip}, limit={limit})")
        
        # Get VM count
        total_count = await database_service.get_jira_vm_count()
        logger.info(f"Total Jira VMs count: {total_count}")
        
        if total_count == 0:
            return JiraVMListResponse(
                status="success",
                message="No Jira VMs found in database",
                total_count=0,
                vms=[]
            )
        
        # Get raw VMs
        vms = await database_service.get_all_jira_vms(skip, limit)
        logger.info(f"Retrieved {len(vms)} raw Jira VM records")
        
        # Convert to Pydantic models with FIXED VMID processing
        vm_models = []
        conversion_errors = 0
        vmid_found_count = 0
        
        for i, vm_data in enumerate(vms):
            try:
                # ✅ FIXED - Extract VMID ONLY if exists, NO fallback
                vmid_value = None
                
                # Priority order for VMID extraction from raw MongoDB data
                vmid_fields = [
                    'VMID',              # ✅ MongoDB has "VMID": "vm-12919" 
                    'vmid', 
                    'VM_ID', 
                    'vm_id',
                    'VirtualMachineID',
                    'VMIdentifier',
                    'ID'
                ]
                
                for field_name in vmid_fields:
                    if field_name in vm_data and vm_data[field_name]:
                        vmid_value = str(vm_data[field_name])
                        vmid_found_count += 1
                        logger.debug(f"VM {vm_data.get('name', 'Unknown')}: VMID = {vmid_value} (from field: {field_name})")
                        break
                
                # ✅ NO FALLBACK - If no VMID found, leave it as None
                if not vmid_value:
                    logger.debug(f"VM {vm_data.get('name', 'Unknown')}: No VMID found, leaving as None")

                # ✅ FIXED - Process data (VMID will be None if not found)
                processed_data = {
                    # Basic info - try multiple field variants from MongoDB
                    'name': (vm_data.get('name') or 
                            vm_data.get('VMName') or           # ✅ MongoDB has "VMName"
                            vm_data.get('vm_name') or 
                            f"VM_{i}"),
                    
                    # ✅ VMID fields (will be None if no real VMID found)
                    'vmid': vmid_value,      # None if not found
                    'VMID': vmid_value,      # None if not found
                    'vm_id': vmid_value,     # None if not found
                    
                    # ... rest of the fields remain the same ...
                    'jira_object_id': vm_data.get('jira_object_id'),
                    'jira_object_key': (vm_data.get('jira_object_key') or 
                                    vm_data.get('Key')),
                    'vm_name': (vm_data.get('VMName') or
                            vm_data.get('vm_name')),
                    'dns_name': (vm_data.get('DNSName') or
                                vm_data.get('dns_name')),
                    'ip_address': (vm_data.get('IPAddress') or
                                vm_data.get('ip_address')),
                    'secondary_ip': vm_data.get('secondary_ip'),
                    'secondary_ip2': vm_data.get('secondary_ip2'),
                    'cpu_count': (vm_data.get('CPU') or
                                vm_data.get('cpu_count')),
                    'memory_gb': (vm_data.get('Memory') or
                                vm_data.get('memory_gb')),
                    'memory_mb': vm_data.get('memory_mb'),
                    'disk_gb': (vm_data.get('Disk') or
                            vm_data.get('disk_gb')),
                    'resource_pool': (vm_data.get('ResourcePool') or
                                    vm_data.get('resource_pool')),
                    'datastore': (vm_data.get('Datastore') or
                                vm_data.get('datastore')),
                    'esxi_cluster': (vm_data.get('ESXiCluster') or
                                vm_data.get('esxi_cluster')),
                    'esxi_host': vm_data.get('esxi_host'),
                    'esxi_port_group': (vm_data.get('ESXiPortGroup') or
                                    vm_data.get('esxi_port_group')),
                    'site': (vm_data.get('Site') or
                            vm_data.get('site')),
                    'description': vm_data.get('description'),
                    'jira_ticket': vm_data.get('jira_ticket'),
                    'criticality_level': vm_data.get('criticality_level'),
                    'created_by': vm_data.get('created_by'),
                    'operating_system': (
                        vm_data.get('OperatingSystem', {}).get('name') if isinstance(vm_data.get('OperatingSystem'), dict) 
                        else vm_data.get('operating_system')
                    ),
                    'platform': vm_data.get('platform'),
                    'kubernetes_cluster': vm_data.get('kubernetes_cluster'),
                    'need_backup': vm_data.get('need_backup'),
                    'backup_type': vm_data.get('backup_type'),
                    'need_monitoring': vm_data.get('need_monitoring'),
                    'responsible_ttl': (vm_data.get('ResponsibleTTL') or
                                    vm_data.get('responsible_ttl')),
                    'tags': vm_data.get('tags', []),
                    'tags_jira_asset': vm_data.get('tags_jira_asset', []),
                    'created_date': (vm_data.get('Created') or
                                vm_data.get('created_date')),
                    'updated_date': (vm_data.get('Updated') or
                                vm_data.get('updated_date')),
                    'last_updated': vm_data.get('last_updated'),
                    'data_source': vm_data.get('data_source', 'jira_asset_management')
                }
                
                # Create Pydantic model (validators will handle conversion)
                vm_model = JiraVirtualMachine(**processed_data)
                vm_models.append(vm_model)
                
            except Exception as e:
                conversion_errors += 1
                logger.warning(f"VM {i} conversion error: {e}")
                logger.debug(f"Failed VM data keys: {list(vm_data.keys())}")
                continue
        
        success_count = len(vm_models)
        
        # ✅ Enhanced logging with VMID statistics
        logger.info(f"Successfully converted {success_count} VMs, {conversion_errors} errors")
        logger.info(f"VMs with VMID: {vmid_found_count}/{success_count} ({vmid_found_count/success_count*100 if success_count > 0 else 0:.1f}%)")
        
        # ✅ Enhanced response message with VMID info
        response_message = f"Retrieved {success_count} Jira VMs"
        if vmid_found_count > 0:
            response_message += f" ({vmid_found_count} with VMID)"
        if conversion_errors > 0:
            response_message += f" ({conversion_errors} conversion errors)"
        
        return JiraVMListResponse(
            status="success",
            message=response_message,
            total_count=total_count,
            vms=vm_models
        )
        
    except Exception as e:
        logger.error(f"Error retrieving Jira VMs: {e}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving Jira VMs: {str(e)}"
        )

# app/api/v1/endpoints.py

@router.get("/get-missing-vms-with-selection", response_model=SelectableVMListResponse)
async def get_missing_vms_with_selection(
    skip: int = Query(0, ge=0, description="Number of VMs to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of VMs")
):
    """
    Get missing VMs with selection capabilities
    """
    try:
        logger.info(f"Retrieving selectable missing VMs (skip={skip}, limit={limit})")
        
        vms = await database_service.get_missing_vms_with_ids(skip, limit)
        total_count = await database_service.get_missing_vm_count()
        
        # Convert to SelectableVM models
        vm_models = []
        for vm_data in vms:
            try:
                selectable_vm = SelectableVM(
                    id=vm_data['id'],
                    vm_name=vm_data.get('vm_name', 'Unknown'),
                    jira_asset_payload=vm_data.get('jira_asset_payload', {}),
                    vm_summary=vm_data.get('vm_summary', {}),
                    status=vm_data.get('status', 'pending_creation'),
                    created_date=vm_data.get('created_date', datetime.utcnow()),
                    selected=False,
                    can_post=vm_data.get('status') == 'pending_creation'
                )
                vm_models.append(selectable_vm)
            except Exception as e:
                logger.warning(f"SelectableVM model conversion error: {e}")
                continue
        
        logger.info(f"Retrieved {len(vm_models)} selectable missing VMs")
        
        return SelectableVMListResponse(
            status="success",
            message=f"Retrieved {len(vm_models)} selectable missing VMs",
            total_count=total_count,
            vms=vm_models
        )
        
    except Exception as e:
        logger.error(f"Error retrieving selectable missing VMs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving selectable missing VMs: {str(e)}"
        )


@router.get("/get-missing-vms-with-selection", response_model=SelectableVMListResponse)
async def get_missing_vms_with_selection(
    skip: int = Query(0, ge=0, description="Number of VMs to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of VMs")
):
    """
    Get missing VMs with selection capabilities
    """
    try:
        logger.info(f"Retrieving selectable missing VMs (skip={skip}, limit={limit})")
        
        vms = await database_service.get_missing_vms_with_ids(skip, limit)
        total_count = await database_service.get_missing_vm_count()
        
        # Convert to SelectableVM models
        vm_models = []
        for vm_data in vms:
            try:
                selectable_vm = SelectableVM(
                    id=vm_data.get('id', str(vm_data.get('_id', ''))),
                    vm_name=vm_data.get('vm_name', 'Unknown'),
                    jira_asset_payload=vm_data.get('jira_asset_payload', {}),
                    vm_summary=vm_data.get('vm_summary', {}),
                    debug_info=vm_data.get('debug_info', {}),
                    status=vm_data.get('status', 'pending_creation'),
                    created_date=vm_data.get('created_date', datetime.utcnow()),
                    selected=False,
                    can_post=vm_data.get('status') == 'pending_creation',
                    source=vm_data.get('source', 'vcenter_diff_processor')
                )
                vm_models.append(selectable_vm)
            except Exception as e:
                logger.warning(f"SelectableVM model conversion error: {e}")
                continue
        
        logger.info(f"Retrieved {len(vm_models)} selectable missing VMs")
        
        return SelectableVMListResponse(
            status="success",
            message=f"Retrieved {len(vm_models)} selectable missing VMs",
            total_count=total_count,
            vms=vm_models
        )
        
    except Exception as e:
        logger.error(f"Error retrieving selectable missing VMs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving selectable missing VMs: {str(e)}"
        )


@router.post("/post-selected-vms-to-jira", response_model=JiraPosterResponse)
async def post_selected_vms_to_jira(
    background_tasks: BackgroundTasks,
    request: SelectedVMsPosterRequest
):
    """
    Post specific selected VMs to Jira Asset Management
    """
    try:
        logger.info(f"Selected VMs Jira Asset posting started for {len(request.vm_ids)} VMs")
        
        if not request.vm_ids:
            raise HTTPException(
                status_code=400,
                detail="No VM IDs provided"
            )
        
        # Extract Jira configuration
        jira_config = {}
        if request.jira_config:
            jira_config = {
                'jira_token': request.jira_config.jira_token,
                'create_url': request.jira_config.create_url,
                'object_type_id': request.jira_config.object_type_id or "3191",
                'object_schema_id': request.jira_config.object_schema_id or "242",
                'delay_seconds': request.jira_config.delay_seconds or 1.0
            }
        
        # Create Jira Poster service
        poster_service = JiraPosterService(
            jira_token=jira_config.get('jira_token'),
            create_url=jira_config.get('create_url'),
            object_type_id=jira_config.get('object_type_id'),
            object_schema_id=jira_config.get('object_schema_id')
        )
        
        # Process selected VMs
        result = poster_service.process_selected_vms(
            vm_ids=request.vm_ids,
            delay=request.delay_seconds or 1.0
        )
        
        if result['status'] == 'success':
            return JiraPosterResponse(
                status="success",
                message=f"{result['successful']} selected VMs posted successfully to Jira, {result['failed']} failed",
                processed=result['processed'],
                successful=result['successful'],
                failed=result['failed'],
                processing_time=result.get('processing_time'),
                results=result.get('results', [])
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=result.get('message', 'Unknown error occurred')
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Selected VMs Jira Asset posting error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Selected VMs Jira Asset posting error: {str(e)}"
        )
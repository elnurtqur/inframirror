"""
API endpoints for VMware Collector
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse

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
        
        # Background task function
        def run_collection():
            return processing_service.collect_vms(
                vcenter_host=vcenter_config['host'] if vcenter_config else None,
                vcenter_username=vcenter_config['username'] if vcenter_config else None,
                vcenter_password=vcenter_config['password'] if vcenter_config else None,
                vcenter_port=vcenter_config['port'] if vcenter_config else None,
                batch_size=request.batch_size,
                max_processes=request.max_processes
            )
        
        # Run immediately (sync)
        result = run_collection()
        
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
        
        # Add as background task
        background_tasks.add_task(
            processing_service.collect_vms,
            vcenter_config['host'] if vcenter_config else None,
            vcenter_config['username'] if vcenter_config else None,
            vcenter_config['password'] if vcenter_config else None,
            vcenter_config['port'] if vcenter_config else None,
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
    Process VM diff between vCenter and Jira - find missing VMs
    """
    try:
        logger.info("VM diff processing started")
        
        # Extract Jira configuration from request
        jira_config = None
        if request.jira_config:
            jira_config = {
                'api_url': request.jira_config.api_url,
                'token': request.jira_config.token,
                'object_type_id': request.jira_config.object_type_id,
                'object_schema_id': request.jira_config.object_schema_id,
                #'cookie': request.jira_config.cookie or ''
            }
        
        # Background task function
        def run_diff_process():
            return diff_service.process_vm_diff(
                api_url=jira_config['api_url'] if jira_config else None,
                token=jira_config['token'] if jira_config else None,
                object_type_id=jira_config['object_type_id'] if jira_config else None,
                object_schema_id=jira_config['object_schema_id'] if jira_config else None,
                #cookie=jira_config['cookie'] if jira_config else None
            )
        
        # Run immediately (sync)
        result = run_diff_process()
        
        if result['status'] == 'success':
            return DiffProcessResponse(
                status="success",
                message=result['message'],
                total_vcenter_vms=result['total_vcenter_vms'],
                total_jira_vms=result['total_jira_vms'],
                missing_vms_count=result['missing_vms_count'],
                processed_missing_vms=result['processed_missing_vms'],
                errors=result['errors'],
                processing_time=result['processing_time']
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
    Get all missing VMs from database (VMs in vCenter but not in Jira)
    """
    try:
        logger.info(f"Retrieving missing VMs from database (skip={skip}, limit={limit})")
        
        vms = await database_service.get_all_missing_vms(skip, limit)
        total_count = await database_service.get_missing_vm_count()
        
        # Convert to Pydantic models
        vm_models = []
        for vm_data in vms:
            try:
                vm_model = MissingVM(**vm_data)
                vm_models.append(vm_model)
            except Exception as e:
                logger.warning(f"Missing VM model conversion error: {e}")
                continue
        
        logger.info(f"Retrieved {len(vm_models)} missing VMs")
        
        return MissingVMListResponse(
            status="success",
            message=f"Retrieved {len(vm_models)} missing VMs",
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
    Get single VM by UUID or MobID
    """
    try:
        # First try UUID
        vm = await database_service.get_vm_by_uuid(identifier)
        
        # If not found by UUID, try MobID
        if not vm:
            vm = await database_service.get_vm_by_mobid(identifier)
        
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
    Get successfully completed Jira Asset creations
    """
    try:
        logger.info(f"Retrieving completed Jira assets (skip={skip}, limit={limit})")
        
        # Get database service for completed assets
        poster_service = JiraPosterService()
        poster_service.get_collections()
        
        # Get completed assets
        cursor = poster_service.completed_collection.find({}).skip(skip).limit(limit).sort('jira_post_date', -1)
        assets = list(cursor)
        
        # Get total count
        total_count = poster_service.completed_collection.count_documents({})
        
        # Convert to Pydantic models
        asset_models = []
        for asset_data in assets:
            try:
                # Remove MongoDB _id field
                if '_id' in asset_data:
                    del asset_data['_id']
                
                asset_model = CompletedJiraAsset(**asset_data)
                asset_models.append(asset_model)
            except Exception as e:
                logger.warning(f"Completed asset model conversion error: {e}")
                continue
        
        logger.info(f"Retrieved {len(asset_models)} completed assets")
        
        return CompletedAssetListResponse(
            status="success",
            message=f"Retrieved {len(asset_models)} completed assets",
            total_count=total_count,
            assets=asset_models
        )
        
    except Exception as e:
        logger.error(f"Error retrieving completed assets: {e}")
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


@router.delete("/delete-failed-jira-assets", response_model=DeleteResponse)
async def delete_failed_jira_assets():
    """
    Delete all failed Jira Asset records
    """
    try:
        logger.info("Deleting failed Jira assets...")
        
        poster_service = JiraPosterService()
        poster_service.get_collections()
        
        result = poster_service.missing_collection.delete_many({'status': 'failed'})
        deleted_count = result.deleted_count
        
        logger.info(f"Deleted {deleted_count} failed Jira assets")
        
        return DeleteResponse(
            status="success",
            message=f"Successfully deleted {deleted_count} failed Jira assets",
            deleted_count=deleted_count
        )
        
    except Exception as e:
        logger.error(f"Error deleting failed assets: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting failed assets: {str(e)}"
        )
    
@router.get("/get-all-jira-vms-from-db", response_model=JiraVMListResponse)
async def get_all_jira_vms_from_db(
    skip: int = Query(0, ge=0, description="Number of VMs to skip"),
    limit: int = Query(1000, ge=1, le=5000, description="Maximum number of VMs")
):
    """
    Get all Jira VMs from database - SIMPLE FIXED VERSION
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
        
        # Convert to Pydantic models with simplified approach
        vm_models = []
        conversion_errors = 0
        
        for i, vm_data in enumerate(vms):
            try:
                # Simple pre-processing of data
                processed_data = {
                    # Ensure name is present
                    'name': vm_data.get('name') or vm_data.get('vm_name') or vm_data.get('VMName') or f"VM_{i}",
                    
                    # Direct copy of simple fields
                    'jira_object_id': vm_data.get('jira_object_id'),
                    'jira_object_key': vm_data.get('jira_object_key'),
                    'vm_name': vm_data.get('vm_name'),
                    'dns_name': vm_data.get('dns_name'),
                    'ip_address': vm_data.get('ip_address'),
                    'secondary_ip': vm_data.get('secondary_ip'),
                    'secondary_ip2': vm_data.get('secondary_ip2'),
                    'resource_pool': vm_data.get('resource_pool'),
                    'datastore': vm_data.get('datastore'),
                    'esxi_cluster': vm_data.get('esxi_cluster'),
                    'esxi_host': vm_data.get('esxi_host'),
                    'esxi_port_group': vm_data.get('esxi_port_group'),
                    'site': vm_data.get('site'),
                    'description': vm_data.get('description'),
                    'jira_ticket': vm_data.get('jira_ticket'),
                    'criticality_level': vm_data.get('criticality_level'),
                    'created_by': vm_data.get('created_by'),
                    'operating_system': vm_data.get('operating_system'),
                    'platform': vm_data.get('platform'),
                    'kubernetes_cluster': vm_data.get('kubernetes_cluster'),
                    'need_backup': vm_data.get('need_backup'),
                    'backup_type': vm_data.get('backup_type'),
                    'need_monitoring': vm_data.get('need_monitoring'),
                    'data_source': vm_data.get('data_source', 'jira_asset_management'),
                    
                    # Copy complex fields as-is (validators will handle them)
                    'cpu_count': vm_data.get('cpu_count'),
                    'memory_gb': vm_data.get('memory_gb'),
                    'memory_mb': vm_data.get('memory_mb'),
                    'disk_gb': vm_data.get('disk_gb'),
                    'responsible_ttl': vm_data.get('responsible_ttl'),
                    'tags': vm_data.get('tags', []),
                    'tags_jira_asset': vm_data.get('tags_jira_asset', []),
                    'created_date': vm_data.get('created_date'),
                    'updated_date': vm_data.get('updated_date'),
                    'last_updated': vm_data.get('last_updated')
                }
                
                # Create Pydantic model (validators will handle conversion)
                vm_model = JiraVirtualMachine(**processed_data)
                vm_models.append(vm_model)
                
            except Exception as e:
                conversion_errors += 1
                logger.warning(f"VM {i} conversion error: {e}")
                continue
        
        success_count = len(vm_models)
        logger.info(f"Successfully converted {success_count} VMs, {conversion_errors} errors")
        
        return JiraVMListResponse(
            status="success",
            message=f"Retrieved {success_count} Jira VMs" + (f" ({conversion_errors} conversion errors)" if conversion_errors > 0 else ""),
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
                'delay_seconds': request.jira_config.delay_seconds or 1.0
            }
        
        # Create Jira Poster service
        poster_service = JiraPosterService(
            jira_token=jira_config.get('jira_token'),
            create_url=jira_config.get('create_url')
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
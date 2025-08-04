"""
Database service for VM data operations - COMPLETE FIXED VERSION
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from pymongo import UpdateOne
from pymongo.errors import BulkWriteError

from app.core.database import get_async_collection, get_sync_collection
from app.core.config import settings
from app.models.models import VirtualMachine

logger = logging.getLogger(__name__)


class DatabaseService:
    """Database service class - COMPLETE FIXED VERSION"""
    
    def __init__(self):
        self.sync_collection = get_sync_collection()
    
    # ========== vCenter VM Methods (unchanged) ==========
    async def get_all_vms(self, skip: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get all VMs from database"""
        try:
            collection = await get_async_collection()
            
            cursor = collection.find({}).skip(skip).limit(limit)
            vms = await cursor.to_list(length=limit)
            
            # Remove MongoDB _id field
            for vm in vms:
                if '_id' in vm:
                    del vm['_id']
            
            logger.info(f"Retrieved {len(vms)} VM records")
            return vms
            
        except Exception as e:
            logger.error(f"Error retrieving VMs: {e}")
            return []
    
    async def get_vm_count(self) -> int:
        """Get total VM count"""
        try:
            collection = await get_async_collection()
            count = await collection.count_documents({})
            return count
        except Exception as e:
            logger.error(f"Error getting VM count: {e}")
            return 0
    
    async def delete_all_vms(self) -> int:
        """Delete all VMs from database"""
        try:
            collection = await get_async_collection()
            result = await collection.delete_many({})
            
            deleted_count = result.deleted_count
            logger.info(f"Deleted {deleted_count} VMs")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error deleting VMs: {e}")
            return 0
    
    def bulk_upsert_vms(self, vm_data_list: List[Dict[str, Any]]) -> Dict[str, int]:
        """Bulk upsert VMs to database"""
        try:
            if not vm_data_list:
                return {'upserted': 0, 'modified': 0, 'errors': 0}
            
            operations = []
            for vm_data in vm_data_list:
                # Filter query
                filter_query = {'uuid': vm_data['uuid']} if vm_data.get('uuid') else {'mobid': vm_data['mobid']}
                
                operation = UpdateOne(
                    filter_query,
                    {'$set': vm_data},
                    upsert=True
                )
                operations.append(operation)
            
            # Bulk write
            result = self.sync_collection.bulk_write(operations, ordered=False)
            
            return {
                'upserted': result.upserted_count,
                'modified': result.modified_count,
                'errors': 0
            }
            
        except BulkWriteError as e:
            logger.error(f"Bulk write error: {e}")
            return {
                'upserted': e.details.get('nUpserted', 0),
                'modified': e.details.get('nModified', 0),
                'errors': len(e.details.get('writeErrors', []))
            }
        except Exception as e:
            logger.error(f"VM bulk upsert error: {e}")
            return {'upserted': 0, 'modified': 0, 'errors': len(vm_data_list)}
    
    def bulk_upsert_jira_vms(self, vm_data_list: List[Dict[str, Any]]) -> Dict[str, int]:
        """Bulk upsert Jira VMs to separate collection"""
        try:
            if not vm_data_list:
                return {'upserted': 0, 'modified': 0, 'errors': 0}
            
            # Get Jira VMs collection
            client = self.sync_collection.database.client
            db = client[settings.mongodb_database]
            jira_collection = db['jira_virtual_machines']
            
            operations = []
            for vm_data in vm_data_list:
                # Filter query by Jira object key
                filter_query = {'jira_object_key': vm_data['jira_object_key']}
                
                operation = UpdateOne(
                    filter_query,
                    {'$set': vm_data},
                    upsert=True
                )
                operations.append(operation)
            
            # Bulk write
            result = jira_collection.bulk_write(operations, ordered=False)
            
            return {
                'upserted': result.upserted_count,
                'modified': result.modified_count,
                'errors': 0
            }
            
        except BulkWriteError as e:
            logger.error(f"Jira VM bulk write error: {e}")
            return {
                'upserted': e.details.get('nUpserted', 0),
                'modified': e.details.get('nModified', 0),
                'errors': len(e.details.get('writeErrors', []))
            }
        except Exception as e:
            logger.error(f"Jira VM bulk upsert error: {e}")
            return {'upserted': 0, 'modified': 0, 'errors': len(vm_data_list)}
    
    async def get_vm_by_uuid(self, uuid: str) -> Optional[Dict[str, Any]]:
        """Find VM by UUID"""
        try:
            collection = await get_async_collection()
            vm = await collection.find_one({'uuid': uuid})
            
            if vm and '_id' in vm:
                del vm['_id']
            
            return vm
        except Exception as e:
            logger.error(f"Error searching VM by UUID {uuid}: {e}")
            return None
    
    async def get_vm_by_mobid(self, mobid: str) -> Optional[Dict[str, Any]]:
        """Find VM by MobID"""
        try:
            collection = await get_async_collection()
            vm = await collection.find_one({'mobid': mobid})
            
            if vm and '_id' in vm:
                del vm['_id']
            
            return vm
        except Exception as e:
            logger.error(f"Error searching VM by MobID {mobid}: {e}")
            return None
    
    async def search_vms(self, query: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Search VMs by query"""
        try:
            collection = await get_async_collection()
            
            # Text search filter
            search_filter = {
                '$or': [
                    {'name': {'$regex': query, '$options': 'i'}},
                    {'guest_hostname': {'$regex': query, '$options': 'i'}},
                    {'ip_address': {'$regex': query, '$options': 'i'}},
                    {'host_name': {'$regex': query, '$options': 'i'}}
                ]
            }
            
            cursor = collection.find(search_filter).limit(limit)
            vms = await cursor.to_list(length=limit)
            
            # Remove MongoDB _id field
            for vm in vms:
                if '_id' in vm:
                    del vm['_id']
            
            logger.info(f"Search '{query}': found {len(vms)} VMs")
            return vms
            
        except Exception as e:
            logger.error(f"VM search error: {e}")
            return []
    
    async def get_vms_by_tag(self, category: str, tag_value: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Find VMs by tag"""
        try:
            collection = await get_async_collection()
            
            # Tag filter
            tag_filter = {f'tags.{category}': tag_value}
            
            cursor = collection.find(tag_filter).limit(limit)
            vms = await cursor.to_list(length=limit)
            
            # Remove MongoDB _id field
            for vm in vms:
                if '_id' in vm:
                    del vm['_id']
            
            logger.info(f"Tag '{category}:{tag_value}': found {len(vms)} VMs")
            return vms
            
        except Exception as e:
            logger.error(f"VM search by tag error: {e}")
            return []
    
    async def get_vm_statistics(self) -> Dict[str, Any]:
        """Get VM statistics"""
        try:
            collection = await get_async_collection()
            
            # Total count
            total_count = await collection.count_documents({})
            
            # Power state distribution
            power_pipeline = [
                {'$group': {'_id': '$power_state', 'count': {'$sum': 1}}}
            ]
            power_stats = await collection.aggregate(power_pipeline).to_list(length=None)
            
            # Guest OS distribution
            os_pipeline = [
                {'$group': {'_id': '$guest_os', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 10}
            ]
            os_stats = await collection.aggregate(os_pipeline).to_list(length=10)
            
            # Host distribution
            host_pipeline = [
                {'$group': {'_id': '$host_name', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 10}
            ]
            host_stats = await collection.aggregate(host_pipeline).to_list(length=10)
            
            return {
                'total_vms': total_count,
                'power_state_distribution': {item['_id']: item['count'] for item in power_stats},
                'top_guest_os': [{'os': item['_id'], 'count': item['count']} for item in os_stats],
                'top_hosts': [{'host': item['_id'], 'count': item['count']} for item in host_stats]
            }
            
        except Exception as e:
            logger.error(f"VM statistics error: {e}")
            return {}
    
    # ========== Jira VM Methods (FIXED) ==========
    async def get_all_jira_vms(self, skip: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get all Jira VMs from database - FIXED VERSION"""
        try:
            # Get async client and Jira collection
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            jira_collection = client[settings.mongodb_database]['jira_virtual_machines']
            
            # ✅ FIXED: Motor async cursor üçün düzgün istifadə
            cursor = jira_collection.find({}).skip(skip).limit(limit)
            vms = await cursor.to_list(length=limit)  # FIXED: length=limit
            
            # Remove MongoDB _id field
            for vm in vms:
                if '_id' in vm:
                    del vm['_id']
            
            logger.info(f"Retrieved {len(vms)} Jira VM records")
            return vms
            
        except Exception as e:
            logger.error(f"Error retrieving Jira VMs: {e}")
            logger.exception("Full traceback for Jira VMs retrieval:")
            return []
    
    async def get_jira_vm_count(self) -> int:
        """Get total Jira VM count - FIXED VERSION"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            jira_collection = client[settings.mongodb_database]['jira_virtual_machines']
            
            # ✅ FIXED: count_documents await ilə 
            count = await jira_collection.count_documents({})
            logger.info(f"Jira VM count: {count}")
            return count
            
        except Exception as e:
            logger.error(f"Error getting Jira VM count: {e}")
            logger.exception("Full traceback for Jira VM count:")
            return 0
    
    async def delete_all_jira_vms(self) -> int:
        """Delete all Jira VMs from database - FIXED VERSION"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            jira_collection = client[settings.mongodb_database]['jira_virtual_machines']
            
            # ✅ FIXED: delete_many await ilə
            result = await jira_collection.delete_many({})
            
            deleted_count = result.deleted_count
            logger.info(f"Deleted {deleted_count} Jira VMs")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error deleting Jira VMs: {e}")
            logger.exception("Full traceback for Jira VMs deletion:")
            return 0
    
    async def get_jira_vm_statistics(self) -> Dict[str, Any]:
        """Get Jira VM statistics - FIXED VERSION"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            jira_collection = client[settings.mongodb_database]['jira_virtual_machines']
            
            # Total count
            total_count = await jira_collection.count_documents({})
            
            # ✅ FIXED: Aggregation pipeline await ilə
            # Operating System distribution
            os_pipeline = [
                {'$group': {'_id': '$operating_system', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 10}
            ]
            os_stats = await jira_collection.aggregate(os_pipeline).to_list(length=10)
            
            # Site distribution
            site_pipeline = [
                {'$group': {'_id': '$site', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 10}
            ]
            site_stats = await jira_collection.aggregate(site_pipeline).to_list(length=10)
            
            # Platform distribution
            platform_pipeline = [
                {'$group': {'_id': '$platform', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 10}
            ]
            platform_stats = await jira_collection.aggregate(platform_pipeline).to_list(length=10)
            
            logger.info(f"Jira VM statistics calculated for {total_count} VMs")
            
            return {
                'total_jira_vms': total_count,
                'top_operating_systems': [{'os': item['_id'], 'count': item['count']} for item in os_stats],
                'top_sites': [{'site': item['_id'], 'count': item['count']} for item in site_stats],
                'top_platforms': [{'platform': item['_id'], 'count': item['count']} for item in platform_stats]
            }
            
        except Exception as e:
            logger.error(f"Jira VM statistics error: {e}")
            logger.exception("Full traceback for Jira VM statistics:")
            return {
                'total_jira_vms': 0,
                'top_operating_systems': [],
                'top_sites': [],
                'top_platforms': []
            }

    # ========== Missing VMs Methods (FIXED) ==========
    async def get_all_missing_vms(self, skip: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get all missing VMs from database - FIXED VERSION"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            missing_collection = client[settings.mongodb_database]['missing_vms_for_jira']
            
            # ✅ FIXED: Motor async cursor üçün düzgün istifadə
            cursor = missing_collection.find({}).skip(skip).limit(limit)
            vms = await cursor.to_list(length=limit)
            
            # Remove MongoDB _id field
            for vm in vms:
                if '_id' in vm:
                    del vm['_id']
            
            logger.info(f"Retrieved {len(vms)} missing VM records")
            return vms
            
        except Exception as e:
            logger.error(f"Error retrieving missing VMs: {e}")
            logger.exception("Full traceback for missing VMs:")
            return []
    
    async def get_missing_vm_count(self) -> int:
        """Get total missing VM count - FIXED VERSION"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            missing_collection = client[settings.mongodb_database]['missing_vms_for_jira']
            
            count = await missing_collection.count_documents({})
            return count
        except Exception as e:
            logger.error(f"Error getting missing VM count: {e}")
            return 0
    
    async def delete_all_missing_vms(self) -> int:
        """Delete all missing VMs from database - FIXED VERSION"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            missing_collection = client[settings.mongodb_database]['missing_vms_for_jira']
            
            result = await missing_collection.delete_many({})
            
            deleted_count = result.deleted_count
            logger.info(f"Deleted {deleted_count} missing VMs")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error deleting missing VMs: {e}")
            return 0

    # ========== Debug Methods ==========
    async def debug_jira_collection(self) -> Dict[str, Any]:
        """Debug Jira collection data"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            
            # Check if jira_virtual_machines collection exists
            collection_names = await client[settings.mongodb_database].list_collection_names()
            
            if 'jira_virtual_machines' not in collection_names:
                return {
                    'error': 'jira_virtual_machines collection does not exist',
                    'available_collections': collection_names
                }
            
            jira_collection = client[settings.mongodb_database]['jira_virtual_machines']
            
            # Get collection stats
            total_count = await jira_collection.count_documents({})
            
            # Get sample documents
            sample_docs = await jira_collection.find({}).limit(3).to_list(length=3)
            
            # Clean up _id fields from samples
            for doc in sample_docs:
                if '_id' in doc:
                    del doc['_id']
            
            return {
                'collection_exists': True,
                'total_documents': total_count,
                'sample_documents': sample_docs,
                'sample_field_names': list(sample_docs[0].keys()) if sample_docs else []
            }
            
        except Exception as e:
            logger.error(f"Debug Jira collection error: {e}")
            return {
                'error': str(e),
                'exception_type': type(e).__name__
            }

    # ========== Jira Asset Management Methods ==========
    async def get_all_completed_assets(self, skip: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get all completed Jira assets from database"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            completed_collection = client[settings.mongodb_database]['completed_jira_assets']
            
            cursor = completed_collection.find({}).skip(skip).limit(limit).sort('jira_post_date', -1)
            assets = await cursor.to_list(length=limit)
            
            # Remove MongoDB _id field
            for asset in assets:
                if '_id' in asset:
                    del asset['_id']
            
            logger.info(f"Retrieved {len(assets)} completed asset records")
            return assets
            
        except Exception as e:
            logger.error(f"Error retrieving completed assets: {e}")
            return []

    async def get_completed_asset_count(self) -> int:
        """Get total completed asset count"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            completed_collection = client[settings.mongodb_database]['completed_jira_assets']
            
            count = await completed_collection.count_documents({})
            return count
        except Exception as e:
            logger.error(f"Error getting completed asset count: {e}")
            return 0

    async def get_all_failed_assets(self, skip: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get all failed Jira assets from database"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            missing_collection = client[settings.mongodb_database]['missing_vms_for_jira']
            
            cursor = missing_collection.find({'status': 'failed'}).skip(skip).limit(limit).sort('failure_date', -1)
            assets = await cursor.to_list(length=limit)
            
            # Remove MongoDB _id field
            for asset in assets:
                if '_id' in asset:
                    del asset['_id']
            
            logger.info(f"Retrieved {len(assets)} failed asset records")
            return assets
            
        except Exception as e:
            logger.error(f"Error retrieving failed assets: {e}")
            return []

    async def get_failed_asset_count(self) -> int:
        """Get total failed asset count"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            missing_collection = client[settings.mongodb_database]['missing_vms_for_jira']
            
            count = await missing_collection.count_documents({'status': 'failed'})
            return count
        except Exception as e:
            logger.error(f"Error getting failed asset count: {e}")
            return 0

    async def delete_all_completed_assets(self) -> int:
        """Delete all completed Jira assets from database"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            completed_collection = client[settings.mongodb_database]['completed_jira_assets']
            
            result = await completed_collection.delete_many({})
            
            deleted_count = result.deleted_count
            logger.info(f"Deleted {deleted_count} completed assets")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error deleting completed assets: {e}")
            return 0

    async def delete_all_failed_assets(self) -> int:
        """Delete all failed Jira assets from database"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            missing_collection = client[settings.mongodb_database]['missing_vms_for_jira']
            
            result = await missing_collection.delete_many({'status': 'failed'})
            
            deleted_count = result.deleted_count
            logger.info(f"Deleted {deleted_count} failed assets")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error deleting failed assets: {e}")
            return 0

    async def get_jira_poster_statistics(self) -> Dict[str, Any]:
        """Get Jira Poster statistics"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            missing_collection = client[settings.mongodb_database]['missing_vms_for_jira']
            completed_collection = client[settings.mongodb_database]['completed_jira_assets']
            
            # Count by status
            pending_count = await missing_collection.count_documents({'status': 'pending_creation'})
            failed_count = await missing_collection.count_documents({'status': 'failed'})
            completed_count = await completed_collection.count_documents({})
            
            # Get recent activity
            recent_pipeline = [
                {'$match': {'jira_post_date': {'$gte': datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)}}},
                {'$group': {'_id': '$status', 'count': {'$sum': 1}}}
            ]
            recent_completed = await completed_collection.aggregate(recent_pipeline).to_list(length=None)
            
            # Get failure reasons
            failure_pipeline = [
                {'$match': {'status': 'failed'}},
                {'$group': {'_id': '$failure_reason', 'count': {'$sum': 1}}},
                {'$sort': {'count': -1}},
                {'$limit': 5}
            ]
            failure_reasons = await missing_collection.aggregate(failure_pipeline).to_list(length=5)
            
            return {
                'pending_creations': pending_count,
                'failed_creations': failed_count,
                'completed_creations': completed_count,
                'total_processed': failed_count + completed_count,
                'success_rate': (completed_count / (failed_count + completed_count) * 100) if (failed_count + completed_count) > 0 else 0,
                'recent_completed_today': sum(item['count'] for item in recent_completed),
                'top_failure_reasons': [{'reason': item['_id'], 'count': item['count']} for item in failure_reasons]
            }
            
        except Exception as e:
            logger.error(f"Jira poster statistics error: {e}")
            return {}

    async def get_missing_vms_with_ids(self, skip: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
        """Get missing VMs with ObjectId for selection - FIXED VERSION"""
        try:
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            missing_collection = client[settings.mongodb_database]['missing_vms_for_jira']
            
            # Get missing VMs with pagination
            cursor = missing_collection.find({}).skip(skip).limit(limit).sort('created_date', -1)
            vms = await cursor.to_list(length=limit)
            
            # Include ObjectId as string for frontend
            for vm in vms:
                vm['id'] = str(vm['_id'])
                # Keep _id for internal use, but add id for frontend
            
            logger.info(f"Retrieved {len(vms)} missing VMs with IDs")
            return vms
            
        except Exception as e:
            logger.error(f"Error retrieving selectable missing VMs: {e}")
            logger.exception("Full traceback:")
            return []

    async def get_vms_by_ids(self, vm_ids: List[str]) -> List[Dict[str, Any]]:
        """Get specific VMs by their IDs - FIXED VERSION"""
        try:
            from bson import ObjectId
            vcenter_collection = await get_async_collection()
            client = vcenter_collection.database.client
            missing_collection = client[settings.mongodb_database]['missing_vms_for_jira']
            
            # Convert string IDs to ObjectIds
            object_ids = []
            for vm_id in vm_ids:
                try:
                    object_ids.append(ObjectId(vm_id))
                except Exception as e:
                    logger.warning(f"Invalid ObjectId: {vm_id} - {e}")
                    continue
            
            if not object_ids:
                logger.warning("No valid ObjectIds found")
                return []
                
            # Find VMs by ObjectIds
            cursor = missing_collection.find({'_id': {'$in': object_ids}})
            vms = await cursor.to_list(length=len(object_ids))
            
            logger.info(f"Retrieved {len(vms)} VMs by IDs from {len(vm_ids)} requested")
            return vms
            
        except Exception as e:
            logger.error(f"Error retrieving VMs by IDs: {e}")
            logger.exception("Full traceback:")
            return []
# File: app/services/jira_poster_service.py
"""
Jira Asset Poster Service - Posts VM payloads to Jira Asset Management
Integrated into VMware Collector FastAPI structure
"""

import json
import time
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
import asyncio
import requests
import urllib3
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

from app.core.config import settings
from app.core.database import get_sync_collection

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


class JiraPosterService:
    """Service for posting VM payloads to Jira Asset Management"""
    
    def __init__(self, jira_token: str = None, create_url: str = None):
        """Initialize Jira Poster Service
        
        Args:
            jira_token: Bearer token for Jira API authentication
            create_url: Jira Asset API endpoint for creating objects
        """
        self.jira_token = jira_token or "your_token_here"
        self.create_url = create_url or "https://jira-support.company.com/rest/insight/1.0/object/create"
        self.session = None
        
        # Get MongoDB collections
        self.missing_collection = None
        self.completed_collection = None
        
    def get_collections(self):
        """Get MongoDB collections for missing and completed VMs"""
        if self.missing_collection is None:
            # Get missing VMs collection
            vcenter_collection = get_sync_collection()
            client = vcenter_collection.database.client
            db = client[settings.mongodb_database]
            self.missing_collection = db['missing_vms_for_jira']
            self.completed_collection = db['completed_jira_assets']
    
    def get_session(self) -> Optional[requests.Session]:
        """Get authenticated Jira API session
        
        Returns:
            Authenticated requests session or None if failed
        """
        try:
            if self.session:
                return self.session
                
            session = requests.Session()
            session.verify = False
            
            # Set authentication headers
            session.headers.update({
                'Authorization': f"Bearer {self.jira_token}",
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            })
            
            self.session = session
            logger.info("Jira API session created successfully")
            return session
            
        except Exception as e:
            logger.error(f"Jira API session error: {e}")
            return None
    
    def get_pending_vms(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get VMs with pending_creation status from database
        
        Args:
            limit: Maximum number of VMs to retrieve
            
        Returns:
            List of pending VM documents
        """
        try:
            self.get_collections()
            
            # Find pending VMs
            query = {'status': 'pending_creation'}
            cursor = self.missing_collection.find(query).sort('created_date', 1)
            
            pending_vms = []
            count = 0
            
            for doc in cursor:
                if limit and count >= limit:
                    break
                pending_vms.append(doc)
                count += 1
            
            logger.info(f"Retrieved {len(pending_vms)} pending VMs")
            return pending_vms
            
        except Exception as e:
            logger.error(f"Error retrieving pending VMs: {e}")
            return []
    
    def post_vm_to_jira(self, vm_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Post single VM to Jira Asset Management
        
        Args:
            vm_doc: VM document from MongoDB
            
        Returns:
            Dictionary with success status and result details
        """
        try:
            session = self.get_session()
            if not session:
                return {'success': False, 'error': 'API session error'}
            
            vm_name = vm_doc.get('vm_name', 'Unknown')
            jira_payload = vm_doc.get('jira_asset_payload', {})
            
            if not jira_payload:
                return {'success': False, 'error': 'Jira payload is empty'}
            
            logger.info(f"🚀 Posting VM '{vm_name}' to Jira...")
            logger.debug(f"Payload: {json.dumps(jira_payload, indent=2)}")
            
            # POST to Jira Asset API
            response = session.post(self.create_url, json=jira_payload, timeout=30)
            
            if response.status_code == 201:
                # Successfully created
                response_data = response.json()
                created_object_key = response_data.get('objectKey', 'Unknown')
                
                logger.info(f"✅ VM '{vm_name}' created successfully: {created_object_key}")
                
                return {
                    'success': True,
                    'object_key': created_object_key,
                    'response_data': response_data,
                    'vm_name': vm_name
                }
                
            elif response.status_code == 400:
                # Bad request - validation error
                error_msg = response.text[:500]  # Limit error message length
                logger.error(f"❌ VM '{vm_name}' validation error: {error_msg}")
                
                return {
                    'success': False,
                    'error': f'Validation error: {error_msg}',
                    'status_code': 400,
                    'vm_name': vm_name
                }
                
            elif response.status_code == 401:
                # Unauthorized
                logger.error(f"❌ VM '{vm_name}' authorization error: 401")
                
                return {
                    'success': False,
                    'error': 'Authorization failed - token invalid',
                    'status_code': 401,
                    'vm_name': vm_name
                }
                
            else:
                # Other errors
                error_msg = response.text[:500]
                logger.error(f"❌ VM '{vm_name}' POST error ({response.status_code}): {error_msg}")
                
                return {
                    'success': False,
                    'error': f'HTTP {response.status_code}: {error_msg}',
                    'status_code': response.status_code,
                    'vm_name': vm_name
                }
                
        except requests.exceptions.Timeout:
            logger.error(f"VM '{vm_name}' POST timeout")
            return {'success': False, 'error': 'Request timeout', 'vm_name': vm_name}
        except Exception as e:
            logger.error(f"VM '{vm_name}' POST exception: {e}")
            return {'success': False, 'error': f'Exception: {str(e)}', 'vm_name': vm_name}
    
    def move_to_completed(self, vm_doc: Dict[str, Any], post_result: Dict[str, Any]) -> bool:
        """Move successfully posted VM to completed collection
        
        Args:
            vm_doc: Original VM document
            post_result: Result from successful POST operation
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.get_collections()
            
            # Create completed document
            completed_doc = vm_doc.copy()
            completed_doc.update({
                'status': 'completed',
                'jira_post_date': datetime.utcnow(),
                'jira_object_key': post_result.get('object_key'),
                'jira_response': post_result.get('response_data'),
                'original_id': vm_doc.get('_id'),
                'processing_completed': True
            })
            
            # Remove MongoDB _id field to avoid conflicts
            if '_id' in completed_doc:
                del completed_doc['_id']
            
            # Insert to completed collection
            self.completed_collection.insert_one(completed_doc)
            
            # Delete original document
            self.missing_collection.delete_one({'_id': vm_doc['_id']})
            
            vm_name = vm_doc.get('vm_name', 'Unknown')
            logger.info(f"📦 VM '{vm_name}' moved to completed collection")
            return True
            
        except Exception as e:
            logger.error(f"Error moving VM to completed: {e}")
            return False
    
    def mark_as_failed(self, vm_doc: Dict[str, Any], post_result: Dict[str, Any]) -> bool:
        """Mark failed POST VM with failed status
        
        Args:
            vm_doc: Original VM document
            post_result: Result from failed POST operation
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.get_collections()
            
            # Update status to failed
            update_doc = {
                'status': 'failed',
                'failure_date': datetime.utcnow(),
                'failure_reason': post_result.get('error', 'Unknown error'),
                'failure_status_code': post_result.get('status_code'),
                'retry_count': vm_doc.get('retry_count', 0) + 1,
                'last_attempt': datetime.utcnow()
            }
            
            self.missing_collection.update_one(
                {'_id': vm_doc['_id']},
                {'$set': update_doc}
            )
            
            vm_name = vm_doc.get('vm_name', 'Unknown')
            logger.warning(f"⚠️ VM '{vm_name}' marked as failed")
            return True
            
        except Exception as e:
            logger.error(f"Error marking VM as failed: {e}")
            return False
    
    def process_vms(self, limit: Optional[int] = None, delay: float = 1.0) -> Dict[str, Any]:
        """Process VMs and POST them to Jira Asset Management
        
        Args:
            limit: Maximum number of VMs to process
            delay: Delay between requests in seconds
            
        Returns:
            Dictionary with processing statistics
        """
        try:
            # Get pending VMs
            pending_vms = self.get_pending_vms(limit)
            
            if not pending_vms:
                logger.info("No pending VMs found for posting")
                return {
                    'status': 'success',
                    'processed': 0,
                    'successful': 0,
                    'failed': 0,
                    'results': []
                }
            
            logger.info(f"📋 Processing {len(pending_vms)} VMs for Jira posting")
            
            # Statistics
            stats = {
                'status': 'success',
                'processed': 0,
                'successful': 0,
                'failed': 0,
                'results': [],
                'start_time': datetime.utcnow(),
                'processing_time': 0
            }
            
            start_time = time.time()
            
            # Process each VM
            for i, vm_doc in enumerate(pending_vms, 1):
                vm_name = vm_doc.get('vm_name', 'Unknown')
                
                logger.info(f"📤 [{i}/{len(pending_vms)}] Processing: {vm_name}")
                
                # POST to Jira
                post_result = self.post_vm_to_jira(vm_doc)
                
                stats['processed'] += 1
                
                if post_result['success']:
                    # Successful POST
                    stats['successful'] += 1
                    self.move_to_completed(vm_doc, post_result)
                    
                    stats['results'].append({
                        'vm_name': vm_name,
                        'status': 'success',
                        'object_key': post_result.get('object_key'),
                        'message': f"Created as {post_result.get('object_key')}"
                    })
                    
                else:
                    # Failed POST
                    stats['failed'] += 1
                    self.mark_as_failed(vm_doc, post_result)
                    
                    stats['results'].append({
                        'vm_name': vm_name,
                        'status': 'failed',
                        'error': post_result.get('error'),
                        'status_code': post_result.get('status_code'),
                        'message': f"Failed: {post_result.get('error')}"
                    })
                
                # Apply rate limiting delay
                if i < len(pending_vms) and delay > 0:
                    time.sleep(delay)
            
            # Calculate final statistics
            end_time = time.time()
            stats['processing_time'] = end_time - start_time
            stats['end_time'] = datetime.utcnow()
            
            # Log final results
            logger.info("=" * 50)
            logger.info("JIRA ASSET POSTER RESULTS:")
            logger.info(f"Processed VMs: {stats['processed']}")
            logger.info(f"Successful POSTs: {stats['successful']}")
            logger.info(f"Failed POSTs: {stats['failed']}")
            logger.info(f"Processing time: {stats['processing_time']:.2f} seconds")
            logger.info("=" * 50)
            
            if stats['successful'] > 0:
                logger.info(f"🎉 {stats['successful']} VMs successfully added to Jira Asset!")
                logger.info("📦 Completed VMs stored in 'completed_jira_assets' collection")
            
            return stats
            
        except Exception as e:
            logger.error(f"Error processing VMs: {e}")
            return {
                'status': 'error',
                'message': f'Processing error: {str(e)}',
                'processed': 0,
                'successful': 0,
                'failed': 0,
                'results': []
            }
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get statistics about VM processing status
        
        Returns:
            Dictionary with counts of VMs in different states
        """
        try:
            self.get_collections()
            
            # Count VMs by status
            pending_count = self.missing_collection.count_documents({'status': 'pending_creation'})
            failed_count = self.missing_collection.count_documents({'status': 'failed'})
            completed_count = self.completed_collection.count_documents({})
            
            # Get retry counts for failed VMs
            failed_vms = list(self.missing_collection.find(
                {'status': 'failed'}, 
                {'vm_name': 1, 'retry_count': 1, 'failure_reason': 1}
            ))
            
            return {
                'pending_vms': pending_count,
                'failed_vms': failed_count,
                'completed_vms': completed_count,
                'total_processed': completed_count + failed_count,
                'failed_vm_details': failed_vms,
                'last_check': datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error getting processing stats: {e}")
            return {
                'error': str(e),
                'pending_vms': 0,
                'failed_vms': 0,
                'completed_vms': 0
            }
    
    def retry_failed_vms(self, max_retries: int = 3) -> Dict[str, Any]:
        """Retry failed VMs that haven't exceeded max retry count
        
        Args:
            max_retries: Maximum number of retry attempts
            
        Returns:
            Processing results for retry attempts
        """
        try:
            self.get_collections()
            
            # Find failed VMs with retry count less than max
            retry_query = {
                'status': 'failed',
                'retry_count': {'$lt': max_retries}
            }
            
            failed_vms = list(self.missing_collection.find(retry_query))
            
            if not failed_vms:
                logger.info("No failed VMs available for retry")
                return {
                    'status': 'success',
                    'message': 'No failed VMs available for retry',
                    'processed': 0,
                    'successful': 0,
                    'failed': 0
                }
            
            logger.info(f"Retrying {len(failed_vms)} failed VMs")
            
            # Reset status to pending for retry
            vm_ids = [vm['_id'] for vm in failed_vms]
            self.missing_collection.update_many(
                {'_id': {'$in': vm_ids}},
                {'$set': {'status': 'pending_creation'}}
            )
            
            # Process the retried VMs
            return self.process_vms(limit=len(failed_vms))
            
        except Exception as e:
            logger.error(f"Error retrying failed VMs: {e}")
            return {
                'status': 'error',
                'message': f'Retry error: {str(e)}',
                'processed': 0
            }

# app/services/jira_poster_service.py

def process_selected_vms(self, vm_ids: List[str], delay: float = 1.0) -> Dict[str, Any]:
    """Process specific selected VMs and POST them to Jira"""
    try:
        # Get VMs by IDs from database
        from app.services.database_service import DatabaseService
        import asyncio
        
        db_service = DatabaseService()
        selected_vms = asyncio.run(db_service.get_vms_by_ids(vm_ids))
        
        if not selected_vms:
            return {
                'status': 'error',
                'message': 'No VMs found with provided IDs',
                'processed': 0,
                'successful': 0,
                'failed': 0
            }
        
        logger.info(f"📋 Processing {len(selected_vms)} selected VMs for Jira posting")
        
        # Statistics
        stats = {
            'status': 'success',
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'results': [],
            'start_time': datetime.utcnow(),
            'processing_time': 0
        }
        
        start_time = time.time()
        
        # Process each selected VM
        for i, vm_doc in enumerate(selected_vms, 1):
            vm_name = vm_doc.get('vm_name', 'Unknown')
            
            logger.info(f"📤 [{i}/{len(selected_vms)}] Processing selected VM: {vm_name}")
            
            # POST to Jira
            post_result = self.post_vm_to_jira(vm_doc)
            
            stats['processed'] += 1
            
            if post_result['success']:
                stats['successful'] += 1
                self.move_to_completed(vm_doc, post_result)
                
                stats['results'].append({
                    'vm_name': vm_name,
                    'status': 'success',
                    'object_key': post_result.get('object_key'),
                    'message': f"Created as {post_result.get('object_key')}"
                })
                
            else:
                stats['failed'] += 1
                self.mark_as_failed(vm_doc, post_result)
                
                stats['results'].append({
                    'vm_name': vm_name,
                    'status': 'failed',
                    'error': post_result.get('error'),
                    'status_code': post_result.get('status_code'),
                    'message': f"Failed: {post_result.get('error')}"
                })
            
            # Apply rate limiting delay
            if i < len(selected_vms) and delay > 0:
                time.sleep(delay)
        
        # Calculate final statistics
        end_time = time.time()
        stats['processing_time'] = end_time - start_time
        
        logger.info("=" * 50)
        logger.info("SELECTED VMs JIRA POSTER RESULTS:")
        logger.info(f"Selected VMs: {len(selected_vms)}")
        logger.info(f"Successful POSTs: {stats['successful']}")
        logger.info(f"Failed POSTs: {stats['failed']}")
        logger.info(f"Processing time: {stats['processing_time']:.2f} seconds")
        logger.info("=" * 50)
        
        return stats
        
    except Exception as e:
        logger.error(f"Error processing selected VMs: {e}")
        return {
            'status': 'error',
            'message': f'Processing error: {str(e)}',
            'processed': 0,
            'successful': 0,
            'failed': 0,
            'results': []
        }
    

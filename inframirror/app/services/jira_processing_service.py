"""
Jira VM collection and processing service with multiprocessing
"""

import time
import logging
from multiprocessing import Pool
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.services.jira_service import JiraService
from app.services.database_service import DatabaseService
from app.core.config import settings

logger = logging.getLogger(__name__)


def process_jira_vm_batch(args):
    """Process Jira VM batch - for multiprocessing"""
    vm_batch, jira_config, batch_id = args
    
    # Create new service instance for each process
    jira_service = JiraService(
        api_url=jira_config['api_url'],
        token='token_here',
        object_type_id=jira_config['object_type_id'],
        object_schema_id=jira_config['object_schema_id'],
        #cookie=jira_config.get('cookie', '')
    )
    
    database_service = DatabaseService()
    
    try:
        batch_vm_data = []
        batch_processed = 0
        batch_errors = 0
        
        for jira_vm in vm_batch:
            try:
                # Extract VM data
                vm_data = jira_service.extract_vm_data(jira_vm)
                if vm_data:
                    batch_vm_data.append(vm_data)
                    batch_processed += 1
                    
                    # Log tag count
                    tag_count = len(vm_data.get('tags', [{}])[0]) if vm_data.get('tags') else 0
                    if tag_count > 0:
                        logger.debug(f"VM {vm_data['name']}: found {tag_count} tags")
                else:
                    batch_errors += 1
                    
            except Exception as e:
                logger.error(f"Error processing VM {jira_vm.get('objectKey', 'Unknown')}: {e}")
                batch_errors += 1
        
        # Bulk write to database
        if batch_vm_data:
            # Use special collection for Jira VMs
            result = database_service.bulk_upsert_jira_vms(batch_vm_data)
            logger.info(f"Batch {batch_id}: {result['upserted']} new, {result['modified']} updated")
        
        return {
            'batch_id': batch_id,
            'processed': batch_processed,
            'errors': batch_errors,
            'message': f'{batch_processed} processed (Jira Asset), {batch_errors} errors'
        }
        
    except Exception as e:
        logger.error(f"Batch {batch_id} processing error: {e}")
        return {
            'batch_id': batch_id,
            'processed': 0,
            'errors': len(vm_batch),
            'message': f'Batch error: {str(e)}'
        }


class JiraProcessingService:
    """Jira VM processing service"""
    
    def __init__(self):
        self.jira_service = JiraService()
        self.database_service = DatabaseService()
    
    def collect_jira_vms(
        self,
        api_url: Optional[str] = None,
        token: Optional[str] = None,
        object_type_id: Optional[str] = None,
        object_schema_id: Optional[str] = None,
        cookie: Optional[str] = None,
        batch_size: Optional[int] = None,
        max_processes: Optional[int] = None
    ) -> Dict[str, Any]:
        """Collect Jira VMs and write to database"""
        
        # Configuration
        jira_config = {
            'api_url': api_url or "https://jira-support.company.com/rest/insight/1.0/object/navlist/iql",
            'token': token or "token_here",
            'object_type_id': object_type_id or "3191",
            'object_schema_id': object_schema_id or "242",
            'cookie': cookie or ""
        }
        
        batch_size = batch_size or settings.batch_size
        max_processes = max_processes or settings.max_processes
        
        # Configure Jira service
        jira_service = JiraService(
            api_url=jira_config['api_url'],
            token='token_here',
            object_type_id=jira_config['object_type_id'],
            object_schema_id=jira_config['object_schema_id'],
            #cookie=jira_config['cookie']
        )
        
        try:
            # Get all VM objects from Jira
            logger.info("Loading VMs from Jira Asset Management API...")
            all_vms = jira_service.get_all_vm_objects()
            if not all_vms:
                return {
                    'status': 'error',
                    'message': 'No VMs found in Jira',
                    'total_vms': 0,
                    'processed_vms': 0,
                    'errors': 0
                }
            
            # Split VMs into batches
            vm_batches = [all_vms[i:i + batch_size] for i in range(0, len(all_vms), batch_size)]
            logger.info(f"Split {len(all_vms)} VMs into {len(vm_batches)} batches")
            
            # Prepare batch arguments
            batch_args = [
                (batch, jira_config, i+1)
                for i, batch in enumerate(vm_batches)
            ]
            
            # Multiprocessing
            start_time = time.time()
            logger.info(f"Starting multiprocessing with {max_processes} processes - Jira Asset VM Collection")
            
            with Pool(processes=max_processes) as pool:
                results = pool.map(process_jira_vm_batch, batch_args)
            
            end_time = time.time()
            
            # Calculate results
            total_processed = sum(r['processed'] for r in results)
            total_errors = sum(r['errors'] for r in results)
            processing_time = end_time - start_time
            
            # Log results
            logger.info("=" * 50)
            logger.info("JIRA VM COLLECTION DETAILS:")
            for result in results:
                logger.info(f"Batch {result['batch_id']}: {result['message']}")
            
            logger.info("=" * 50)
            logger.info("OVERALL RESULTS:")
            logger.info(f"Total VMs: {len(all_vms)}")
            logger.info(f"Successfully processed (Jira Asset): {total_processed}")
            logger.info(f"Errors: {total_errors}")
            logger.info(f"Processing time: {processing_time:.2f} seconds")
            logger.info(f"VMs/second: {len(all_vms)/processing_time:.2f}")
            
            return {
                'status': 'success',
                'message': f'{total_processed} Jira VMs processed successfully',
                'total_vms': len(all_vms),
                'processed_vms': total_processed,
                'errors': total_errors,
                'processing_time': processing_time,
                'batches': results
            }
            
        except Exception as e:
            logger.error(f"Jira VM collection error: {e}")
            return {
                'status': 'error',
                'message': f'Jira VM collection error: {str(e)}',
                'total_vms': 0,
                'processed_vms': 0,
                'errors': 0
            }
    
    async def get_jira_collection_status(self) -> Dict[str, Any]:
        """Get Jira collection status"""
        try:
            jira_vm_count = await self.database_service.get_jira_vm_count()
            jira_stats = await self.database_service.get_jira_vm_statistics()
            
            return {
                'status': 'success',
                'jira_vm_count': jira_vm_count,
                'jira_statistics': jira_stats,
                'last_check': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Jira collection status error: {e}")
            return {
                'status': 'error',
                'message': str(e)
            }
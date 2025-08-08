"""
VM collection and processing service with multiprocessing
"""

import time
import logging
from multiprocessing import Pool
from typing import List, Dict, Any, Optional
from datetime import datetime

from pyVim.connect import Disconnect

from app.services.vcenter_service import VCenterService
from app.services.database_service import DatabaseService
from app.core.config import settings

logger = logging.getLogger(__name__)


def process_vm_batch(args):
    """VM batch'ini emal et - multiprocessing üçün"""
    vm_ref_batch, vcenter_config, batch_id = args
    
    # Her process üçün yeni service instance'ları yarat
    vcenter_service = VCenterService(
        host=vcenter_config['host'],
        username=vcenter_config['username'],
        password=vcenter_config['password'],
        port=vcenter_config['port'],
        default_site=vcenter_config.get('default_site'),
        default_zone=vcenter_config.get('default_zone')
    )
    
    database_service = DatabaseService()
    
    # vCenter bağlantısı
    si = vcenter_service.connect_vcenter()
    if not si:
        return {
            'batch_id': batch_id,
            'processed': 0,
            'errors': len(vm_ref_batch),
            'message': 'vCenter bağlantı xətası'
        }
    
    try:
        batch_vm_data = []
        batch_processed = 0
        batch_errors = 0
        default_applied = 0
        
        for vm_ref in vm_ref_batch:
            try:
                # VM obyektini tap
                vm = vcenter_service.find_vm_by_ref(si, vm_ref)
                if not vm:
                    logger.warning(f"VM {vm_ref['name']} tapılmadı")
                    batch_errors += 1
                    continue
                
                # VM məlumatlarını çıxar
                vm_data = vcenter_service.extract_vm_data(si, vm)
                if vm_data:
                    batch_vm_data.append(vm_data)
                    batch_processed += 1

                    if vm_data.get('tags'):
                        vm_tags = vm_data['tags'][0] if vm_data['tags'] else {}
                        if (vcenter_config.get('default_site') and vm_tags.get('Site') == vcenter_config.get('default_site')) or \
                           (vcenter_config.get('default_zone') and vm_tags.get('Zone') == vcenter_config.get('default_zone')):
                            default_applied += 1
                    
                    # Tag sayını log et
                    tag_count = len(vm_data.get('tags', []))
                    if tag_count > 0:
                        logger.debug(f"VM {vm_data['name']}: {tag_count} tag tapıldı")
                else:
                    batch_errors += 1
                    
            except Exception as e:
                logger.error(f"VM {vm_ref.get('name', 'Unknown')} emal xətası: {e}")
                batch_errors += 1
        
        # Database'ə bulk write
        if batch_vm_data:
            result = database_service.bulk_upsert_vms(batch_vm_data)
            logger.info(f"Batch {batch_id}: {result['upserted']} yeni, {result['modified']} yenilənmiş")
        
        return {
            'batch_id': batch_id,
            'processed': batch_processed,
            'errors': batch_errors,
            'default_applied': default_applied,
            'message': f'{batch_processed} emal, {batch_errors} xəta'
        }
        
    except Exception as e:
        logger.error(f"Batch {batch_id} emal xətası: {e}")
        return {
            'batch_id': batch_id,
            'processed': 0,
            'errors': len(vm_ref_batch),
            'message': f'Batch xətası: {str(e)}'
        }
    finally:
        Disconnect(si)


class ProcessingService:
    """VM processing service"""
    
    def __init__(self):
        self.vcenter_service = VCenterService()
        self.database_service = DatabaseService()
    
    def collect_vms(
        self,
        vcenter_host: Optional[str] = None,
        vcenter_username: Optional[str] = None,
        vcenter_password: Optional[str] = None,
        vcenter_port: Optional[int] = None,
        default_site: Optional[str] = None,
        default_zone: Optional[str] = None,
        batch_size: Optional[int] = None,
        max_processes: Optional[int] = None
    ) -> Dict[str, Any]:
        """VM'ləri topla və database'ə yaz"""
        
        # Konfiqurasiya
        vcenter_config = {
            'host': vcenter_host or settings.vcenter_host,
            'username': vcenter_username or settings.vcenter_username,
            'password': vcenter_password or settings.vcenter_password,
            'port': vcenter_port or settings.vcenter_port,
            'default_site': default_site,
            'default_zone': default_zone
        }
        
        batch_size = batch_size or settings.batch_size
        max_processes = max_processes or settings.max_processes
        
        if default_site or default_zone:
            logger.info(f"Default dəyərlər təyin edildi - Site: {default_site}, Zone: {default_zone}")

        # vCenter service'i konfiq et
        vcenter_service = VCenterService(
            host=vcenter_config['host'],
            username=vcenter_config['username'],
            password=vcenter_config['password'],
            port=vcenter_config['port'],
            default_site=vcenter_config['default_site'],  # ✅ YENİ
            default_zone=vcenter_config['default_zone']   # ✅ YENİ
        )
        
        try:
            # vCenter bağlantısı və VM ref'lərini əldə et
            logger.info("vCenter'a bağlanılır...")
            si = vcenter_service.connect_vcenter()
            if not si:
                return {
                    'status': 'error',
                    'message': 'vCenter bağlantısı alınmadı',
                    'total_vms': 0,
                    'processed_vms': 0,
                    'errors': 0
                }
            
            vm_refs = vcenter_service.get_all_vm_refs(si)
            if not vm_refs:
                Disconnect(si)
                return {
                    'status': 'error',
                    'message': 'VM ref\'ləri tapılmadı',
                    'total_vms': 0,
                    'processed_vms': 0,
                    'errors': 0
                }
            
            # VM ref'lərini batch'lərə böl
            vm_ref_batches = [vm_refs[i:i + batch_size] for i in range(0, len(vm_refs), batch_size)]
            logger.info(f"{len(vm_refs)} VM ref {len(vm_ref_batches)} batch'ə bölündü")
            
            Disconnect(si)
            
            # Batch argümanlarını hazırla
            batch_args = [
                (batch, vcenter_config, i+1)
                for i, batch in enumerate(vm_ref_batches)
            ]
            
            # Multiprocessing ilə emal
            start_time = time.time()
            logger.info(f"Multiprocessing başladı ({max_processes} prosess)")
            
            with Pool(processes=max_processes) as pool:
                results = pool.map(process_vm_batch, batch_args)
            
            end_time = time.time()
            
            # Nəticələri hesabla
            total_processed = sum(r['processed'] for r in results)
            total_errors = sum(r['errors'] for r in results)
            total_defaults = sum(r.get('default_applied', 0) for r in results)
            processing_time = end_time - start_time
            
            # Nəticələri log et
            logger.info("=" * 50)
            logger.info("EMAL TƏFSİLATI:")
            for result in results:
                logger.info(f"Batch {result['batch_id']}: {result['message']}")
            
            logger.info("=" * 50)
            logger.info("ÜMUMİ NƏTİCƏ:")
            logger.info(f"Toplam VM sayı: {len(vm_refs)}")
            logger.info(f"Uğurla emal: {total_processed}")
            logger.info(f"Xəta sayı: {total_errors}")
            logger.info(f"Default dəyər tətbiq edildi: {total_defaults}")
            logger.info(f"Emal müddəti: {processing_time:.2f} saniyə")
            logger.info(f"VM/saniyə: {len(vm_refs)/processing_time:.2f}")
            
            return {
                'status': 'success',
                'message': f'{total_processed} VM uğurla emal edildi',
                'total_vms': len(vm_refs),
                'processed_vms': total_processed,
                'errors': total_errors,
                'default_applied': total_defaults,
                'processing_time': processing_time,
                'batches': results
            }
            
        except Exception as e:
            logger.error(f"VM collection xətası: {e}")
            return {
                'status': 'error',
                'message': f'VM collection xətası: {str(e)}',
                'total_vms': 0,
                'processed_vms': 0,
                'errors': 0
            }
    
    async def get_collection_status(self) -> Dict[str, Any]:
        """Collection status əldə et"""
        try:
            vm_count = await self.database_service.get_vm_count()
            stats = await self.database_service.get_vm_statistics()
            
            return {
                'status': 'success',
                'vm_count': vm_count,
                'statistics': stats,
                'last_check': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Collection status xətası: {e}")
            return {
                'status': 'error',
                'message': str(e)
            }
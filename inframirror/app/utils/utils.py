"""
Utility functions
"""

import ssl
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
import urllib3

# SSL warnings'lari söndür
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)


def create_ssl_context() -> ssl.SSLContext:
    """SSL context yarat"""
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def format_bytes_to_gb(bytes_value: int) -> float:
    """Bytes'i GB'a çevir"""
    return round(bytes_value / (1024 ** 3), 2)


def format_kb_to_gb(kb_value: int) -> float:
    """KB'i GB'a çevir"""
    return round(kb_value / (1024 ** 2), 2)


def format_mb_to_gb(mb_value: int) -> float:
    """MB'i GB'a çevir"""
    return round(mb_value / 1024, 2)


def sanitize_vm_name(name: str) -> str:
    """VM adını təmizlə"""
    if not name:
        return "Unknown"
    
    # Xüsusi simvolları çıxar
    sanitized = ''.join(c for c in name if c.isalnum() or c in ['-', '_', '.', ' '])
    return sanitized.strip()


def parse_tag_mapping(tags: List[Dict[str, Any]]) -> Dict[str, str]:
    """Tag'ları key-value mapping'ə çevir"""
    mapping = {}
    
    for tag in tags:
        category_name = tag.get('category_name')
        tag_name = tag.get('tag_name')
        
        if category_name and tag_name:
            mapping[category_name] = tag_name
    
    return mapping


def create_jira_asset_tags(processed_tags: Dict[str, str]) -> Dict[str, str]:
    """Jira Asset üçün tag mapping yarat"""
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
    
    return jira_tags


def calculate_processing_stats(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Processing statistikalarını hesabla"""
    total_processed = sum(r.get('processed', 0) for r in results)
    total_errors = sum(r.get('errors', 0) for r in results)
    
    return {
        'total_batches': len(results),
        'total_processed': total_processed,
        'total_errors': total_errors,
        'success_rate': (total_processed / (total_processed + total_errors) * 100) if (total_processed + total_errors) > 0 else 0
    }


def validate_vcenter_config(config: Dict[str, Any]) -> bool:
    """vCenter konfiqurasiyanı yoxla"""
    required_fields = ['host', 'username', 'password']
    
    for field in required_fields:
        if not config.get(field):
            logger.error(f"vCenter konfiq xətası: {field} boşdur")
            return False
    
    return True


def format_datetime_for_json(dt: datetime) -> str:
    """Datetime'i JSON üçün format et"""
    if dt:
        return dt.isoformat()
    return None


def safe_get_attribute(obj: Any, attr_path: str, default: Any = None) -> Any:
    """Təhlükəsiz şəkildə nested attribute əldə et"""
    try:
        attrs = attr_path.split('.')
        result = obj
        
        for attr in attrs:
            if hasattr(result, attr):
                result = getattr(result, attr)
            else:
                return default
        
        return result
    except Exception:
        return default


def chunk_list(lst: List[Any], chunk_size: int) -> List[List[Any]]:
    """List'i chunk'lara böl"""
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]


def log_processing_progress(current: int, total: int, prefix: str = "Progress"):
    """Processing progress'ini log et"""
    percentage = (current / total * 100) if total > 0 else 0
    logger.info(f"{prefix}: {current}/{total} ({percentage:.1f}%)")


def create_error_response(message: str, status_code: int = 500) -> Dict[str, Any]:
    """Error response yarat"""
    return {
        'status': 'error',
        'message': message,
        'timestamp': datetime.utcnow().isoformat(),
        'status_code': status_code
    }


def create_success_response(data: Any = None, message: str = "Success") -> Dict[str, Any]:
    """Success response yarat"""
    response = {
        'status': 'success',
        'message': message,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    if data is not None:
        response['data'] = data
    
    return response


def mask_sensitive_config(config: Dict[str, Any]) -> Dict[str, Any]:
    """Sensitive məlumatları mask et"""
    masked_config = config.copy()
    
    sensitive_fields = ['password', 'token', 'api_key', 'secret']
    
    for field in sensitive_fields:
        if field in masked_config:
            value = masked_config[field]
            if isinstance(value, str) and len(value) > 4:
                masked_config[field] = value[:2] + '*' * (len(value) - 4) + value[-2:]
            else:
                masked_config[field] = '***'
    
    return masked_config
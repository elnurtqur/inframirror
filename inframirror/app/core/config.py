"""
Application configuration settings
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # FastAPI settings
    app_name: str = "VMware Collector API"
    app_version: str = "1.0.0"
    debug: bool = False
    
    # MongoDB settings
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "vmware_inventory"
    mongodb_collection: str = "virtual_machines"
    
    # Default vCenter settings (can be overridden in API calls)
    vcenter_host: str = "kb-bnk-bmdc-vc1.company.com"
    vcenter_username: str = "aa"
    vcenter_password: str = "aa"
    vcenter_port: int = 443
    
    # Default Jira settings (can be overridden in API calls)
    jira_api_url: str = "https://jira-support.company.com/rest/insight/1.0/object/navlist/iql"
    jira_token: str = "aaaaa"
    jira_object_type_id: str = "3191"
    jira_object_schema_id: str = "242"

    jira_create_url: str = "https://jira-support.company.com/rest/insight/1.0/object/create"
    jira_poster_delay: float = 1.0  # Delay between requests in seconds
    jira_max_retries: int = 3
    # Processing settings
    batch_size: int = 50
    max_processes: int = 8
    
    # Redis settings (for Celery)
    redis_url: str = "redis://localhost:6379/0"
    
    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
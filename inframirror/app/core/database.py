"""
MongoDB database connection and initialization
"""

import motor.motor_asyncio
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
import logging

from .config import settings

logger = logging.getLogger(__name__)

# Async MongoDB client
async_client = motor.motor_asyncio.AsyncIOMotorClient(settings.mongodb_uri)
async_database = async_client[settings.mongodb_database]
async_collection = async_database[settings.mongodb_collection]

# Sync MongoDB client (multiprocessing üçün)
sync_client = None
sync_database = None
sync_collection = None


def get_sync_client():
    """Sync MongoDB client əldə et"""
    global sync_client, sync_database, sync_collection
    
    if not sync_client:
        sync_client = MongoClient(settings.mongodb_uri)
        sync_database = sync_client[settings.mongodb_database]
        sync_collection = sync_database[settings.mongodb_collection]
    
    return sync_client, sync_database, sync_collection


def init_database():
    """Database initialize et"""
    try:
        # Sync client test
        client, db, collection = get_sync_client()
        client.admin.command('ping')
        logger.info(f"MongoDB bağlantısı uğurlu: {settings.mongodb_uri}")
        
        # Index'lər yarat
        collection.create_index("uuid", unique=True, sparse=True)
        collection.create_index("vmid", unique=True)
        collection.create_index("name")
        collection.create_index("last_updated")
        
        logger.info("MongoDB index'lər yaradıldı")
        
    except ConnectionFailure as e:
        logger.error(f"MongoDB bağlantı xətası: {e}")
        raise


async def get_async_collection():
    """Async collection əldə et"""
    return async_collection


def get_sync_collection():
    """Sync collection əldə et"""
    _, _, collection = get_sync_client()
    return collection
#!/usr/bin/env python3
"""
VMware vCenter məlumatlarını toplamaq və MongoDB'yə yazmaq üçün FastAPI aplikasiyası
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.api.v1 import endpoints
from app.core.config import settings
from app.core.database import init_database

# Logging konfiqurasiyası
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('vmware_collector.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager"""
    # Startup
    logger.info("VMware Collector API başladı")
    init_database()
    yield
    # Shutdown
    logger.info("VMware Collector API bağlandı")

app = FastAPI(
    title="VMware Collector API",
    description="VMware vCenter məlumatlarını toplamaq və MongoDB'yə yazmaq üçün API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(endpoints.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "VMware Collector API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
# VMware Collector FastAPI

VMware vCenter and Jira Asset Management data collection API with comprehensive VM processing capabilities.

## Features

- **vCenter VM Collection**: Collect VMs from vCenter with multiprocessing and tag support
- **Jira Asset Management Integration**: Collect VMs from Jira Asset Management API
- **VM Diff Processing**: Compare vCenter and Jira VMs, find missing VMs
- **Multiple Database Collections**: Separate collections for different data sources
- **RESTful API Endpoints**: Comprehensive API with async/sync operations
- **Tag Processing**: Support for both vCenter tags and Jira Asset tag mapping
- **Multiprocessing**: High-performance parallel processing
- **Detailed Logging**: Comprehensive logging and error handling

## Project Structure

```
app/
├── api/
│   └── v1/
│       └── endpoints.py          # API endpoints
├── core/
│   ├── config.py                 # Configuration
│   └── database.py               # Database connections
├── models/
│   └── models.py                 # Pydantic models
├── services/
│   ├── vcenter_service.py        # vCenter integration
│   ├── jira_service.py           # Jira Asset Management integration
│   ├── processing_service.py     # vCenter VM processing
│   ├── jira_processing_service.py # Jira VM processing
│   ├── diff_service.py           # VM diff processing
│   └── database_service.py       # Database operations
└── utils/
    └── utils.py                  # Utility functions
main.py                           # FastAPI app entry point
requirements.txt                  # Python dependencies
Dockerfile                       # Docker configuration
docker-compose.yml               # Docker Compose
.env.example                     # Environment variables example
```

## Installation

### 1. Local Development

```bash
# Clone repository
git clone <repository-url>
cd vmware-collector-fastapi

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env file

# Start application
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Docker

```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f vmware-collector
```

## Configuration

Set the following parameters in `.env` file:

```bash
# Default vCenter connection (can be overridden in API calls)
VCENTER_HOST=your-vcenter-host.com
VCENTER_USERNAME=your-username
VCENTER_PASSWORD=your-password

# MongoDB connection
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=vmware_inventory

# Processing parameters
BATCH_SIZE=50
MAX_PROCESSES=8
```

## Database Collections

The API uses three MongoDB collections:

- **`virtual_machines`** - vCenter VMs
- **`jira_virtual_machines`** - Jira Asset Management VMs  
- **`missing_vms_for_jira`** - VMs in vCenter but missing from Jira

## API Endpoints

### 1. vCenter VM Collection

```bash
# Collect VMs from vCenter (sync)
POST /api/v1/collect-vms
Content-Type: application/json

{
  "vcenter_config": {
    "host": "your-vcenter.com",
    "username": "your-username",
    "password": "your-password",
    "port": 443
  },
  "batch_size": 50,
  "max_processes": 8
}
```

```bash
# Collect VMs from vCenter (async background task)
POST /api/v1/collect-vms-async
```

### 2. Jira Asset Management VM Collection

```bash
# Collect VMs from Jira Asset Management (sync)
POST /api/v1/collect-jira-vms
Content-Type: application/json

{
  "jira_config": {
    "api_url": "https://jira-support.company.com/rest/insight/1.0/object/navlist/iql",
    "token": "your-bearer-token",
    "object_type_id": "3191",
    "object_schema_id": "242",
    "cookie": "optional-session-cookie"
  },
  "batch_size": 50,
  "max_processes": 8
}
```

```bash
# Collect VMs from Jira Asset Management (async)
POST /api/v1/collect-jira-vms-async
```

### 3. VM Diff Processing

```bash
# Process VM diff between vCenter and Jira (sync)
POST /api/v1/process-vm-diff
Content-Type: application/json

{
  "jira_config": {
    "api_url": "https://jira-support.company.com/rest/insight/1.0/object/navlist/iql",
    "token": "your-bearer-token",
    "object_type_id": "3191",
    "object_schema_id": "242"
  }
}
```

```bash
# Process VM diff (async background task)
POST /api/v1/process-vm-diff-async
```

### 4. Data Retrieval

```bash
# Get all vCenter VMs
GET /api/v1/get-all-vms-from-db?skip=0&limit=1000

# Search vCenter VMs
GET /api/v1/get-all-vms-from-db?search=vm-name

# Filter vCenter VMs by tag
GET /api/v1/get-all-vms-from-db?tag_category=Environment&tag_value=Production

# Get all Jira VMs
GET /api/v1/get-all-jira-vms-from-db?skip=0&limit=1000

# Get missing VMs (in vCenter but not in Jira)
GET /api/v1/get-all-missing-vms-from-db?skip=0&limit=1000

# Get single VM by UUID or MobID
GET /api/v1/vm/{identifier}
```

### 5. Statistics and Monitoring

```bash
# vCenter VM statistics
GET /api/v1/statistics

# Jira VM statistics  
GET /api/v1/jira-statistics

# Collection status
GET /api/v1/collection-status

# Health check
GET /api/v1/health
GET /health
```

### 6. Database Management

```bash
# Delete all vCenter VMs
DELETE /api/v1/delete-all-vms-from-db

# Delete all Jira VMs
DELETE /api/v1/delete-all-jira-vms-from-db

# Delete all missing VMs
DELETE /api/v1/delete-all-missing-vms-from-db
```

## Workflow Examples

### Complete Data Collection Workflow

```bash
# Step 1: Collect vCenter VMs
curl -X POST "http://localhost:8000/api/v1/collect-vms" \
     -H "Content-Type: application/json" \
     -d '{
       "vcenter_config": {
         "host": "vcenter.company.com",
         "username": "admin",
         "password": "password"
       }
     }'

# Step 2: Collect Jira VMs
curl -X POST "http://localhost:8000/api/v1/collect-jira-vms" \
     -H "Content-Type: application/json" \
     -d '{
       "jira_config": {
         "api_url": "https://jira.company.com/rest/insight/1.0/object/navlist/iql",
         "token": "your-token"
       }
     }'

# Step 3: Process VM diff to find missing VMs
curl -X POST "http://localhost:8000/api/v1/process-vm-diff" \
     -H "Content-Type: application/json" \
     -d '{
       "jira_config": {
         "api_url": "https://jira.company.com/rest/insight/1.0/object/navlist/iql",
         "token": "your-token"
       }
     }'

# Step 4: Get missing VMs
curl "http://localhost:8000/api/v1/get-all-missing-vms-from-db"
```

## Features

### Tag Processing

The application processes VM tags using multiple methods:

1. **vSphere 7+ REST API** - Latest method
2. **CIS REST API** - For older versions  
3. **Custom Attributes** - Alternative when tags are not available

Tags are stored in two formats:

- **Normal format**: Original tag structure
- **Jira Asset format**: Mapped for Jira Asset integration

### Multiprocessing

VMs are split into batches and processed in parallel:

- Configurable batch size
- Configurable process count
- Detailed progress logging

### Database Operations

- **Async operations**: For API responses
- **Sync operations**: For multiprocessing
- **Bulk operations**: For performance
- **Indexing**: For optimal queries

## Performance

Typical performance examples:

- **1000 VMs**: ~2-3 minutes (8 processes)
- **5000 VMs**: ~10-15 minutes (8 processes)
- **Database operations**: Uses bulk upsert

## Monitoring and Logging

Detailed log information:

```bash
# Log file
tail -f vmware_collector.log

# Docker logs
docker-compose logs -f vmware-collector
```

Log levels:

- **INFO**: Main operations
- **DEBUG**: Detailed information
- **ERROR**: Errors
- **WARNING**: Warnings

## API Documentation

After starting the application:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Troubleshooting

### vCenter Connection Issues

```bash
# SSL certificate issues
# Code disables SSL verification

# Authentication issues
# Check username/password

# Network issues  
# Check host:port accessibility
```

### MongoDB Issues

```bash
# Connection issues
# Check MongoDB URI

# Index issues
# Application creates indexes automatically

# Disk space issues
# Check MongoDB disk space
```

### Performance Issues

```bash
# Reduce batch size
BATCH_SIZE=25

# Reduce process count
MAX_PROCESSES=4

# Monitor vCenter load
```

## Development

### Test Environment

```bash
# For development
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# API documentation
http://localhost:8000/docs
http://localhost:8000/redoc
```

### Code Structure

- **services/**: Business logic
- **models/**: Data models  
- **api/**: API endpoints
- **core/**: Configuration and database
- **utils/**: Helper functions

## Security

- SSL verification disabled (for vCenter)
- Sensitive data in environment variables
- Password masking in logs
- Input validation with Pydantic

## Future Enhancements

- [ ] Celery with background tasks
- [ ] WebSocket real-time updates
- [ ] Authentication and authorization  
- [ ] Caching (Redis)
- [ ] Metrics and monitoring (Prometheus)
- [ ] Scheduled collections
- [ ] Multiple vCenter support
- [ ] Jira Asset creation API integration
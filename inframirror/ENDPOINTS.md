# VMware Collector API - Complete Documentation

## Overview

VMware Collector API is a comprehensive FastAPI application for collecting and managing VM data from vCenter and Jira Asset Management systems. It provides full CRUD operations, diff processing, Jira Asset posting, and multiprocessing capabilities.

**Base URL**: `http://localhost:8000`  
**API Version**: v1  
**Documentation**: `http://localhost:8000/docs` (Swagger UI)

---

## 📊 Database Collections

The API manages four MongoDB collections:

- **`virtual_machines`** - vCenter VMs data
- **`jira_virtual_machines`** - Jira Asset Management VMs  
- **`missing_vms_for_jira`** - VMs in vCenter but missing from Jira
- **`completed_jira_assets`** - Successfully created Jira assets

---

## 🔐 Authentication

All Jira-related endpoints support token-based authentication:

```json
{
  "jira_config": {
    "api_url": "https://jira-support.company.com/rest/insight/1.0/object/navlist/iql",
    "token": "YOUR_BEARER_TOKEN",
    "object_type_id": "3191",
    "object_schema_id": "242",
    "cookie": "optional_session_cookie"
  }
}
```

---

## 📋 API Endpoints

### 1. vCenter VM Collection

#### 1.1 Collect VMs from vCenter (Sync)
**POST** `/api/v1/collect-vms`

Collects VMs from vCenter server and stores them in MongoDB synchronously.

**Request Body:**
```json
{
  "vcenter_config": {
    "host": "vcenter.company.com",
    "username": "admin",
    "password": "password123",
    "port": 443
  },
  "batch_size": 50,
  "max_processes": 8
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/collect-vms" \
     -H "Content-Type: application/json" \
     -d '{
       "vcenter_config": {
         "host": "vcenter.company.com",
         "username": "admin",
         "password": "password123"
       },
       "batch_size": 50,
       "max_processes": 8
     }'
```

**Response:**
```json
{
  "status": "success",
  "message": "1500 VMs processed successfully",
  "total_vms": 1500,
  "processed_vms": 1498,
  "errors": 2,
  "processing_time": 120.5
}
```

#### 1.2 Collect VMs from vCenter (Async)
**POST** `/api/v1/collect-vms-async`

Same as above but runs as background task.

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/collect-vms-async" \
     -H "Content-Type: application/json" \
     -d '{
       "vcenter_config": {
         "host": "vcenter.company.com",
         "username": "admin",
         "password": "password123"
       }
     }'
```

**Response:**
```json
{
  "status": "accepted",
  "message": "VM collection background task started. Check logs for progress."
}
```

---

### 2. Jira Asset Management VM Collection

#### 2.1 Collect VMs from Jira Asset Management (Sync)
**POST** `/api/v1/collect-jira-vms`

Collects VMs from Jira Asset Management API and stores them in MongoDB.

**Request Body:**
```json
{
  "jira_config": {
    "api_url": "https://jira-support.company.com/rest/insight/1.0/object/navlist/iql",
    "token": "token_here",
    "object_type_id": "3191",
    "object_schema_id": "242",
    "cookie": "JSESSIONID=s1~4699CC0492DB5FA67FDB3DD467D2B233"
  },
  "batch_size": 50,
  "max_processes": 8
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/collect-jira-vms" \
     -H "Content-Type: application/json" \
     -d '{
       "jira_config": {
         "token": "token_here"
       }
     }'
```

**Response:**
```json
{
  "status": "success",
  "message": "2002 Jira VMs processed successfully",
  "total_vms": 2002,
  "processed_vms": 2002,
  "errors": 0,
  "processing_time": 1.58
}
```

#### 2.2 Collect VMs from Jira Asset Management (Async)
**POST** `/api/v1/collect-jira-vms-async`

Same as above but runs as background task.

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/collect-jira-vms-async" \
     -H "Content-Type: application/json" \
     -d '{
       "jira_config": {
         "token": "YOUR_TOKEN"
       }
     }'
```

---

### 3. VM Diff Processing

#### 3.1 Process VM Diff (Sync)
**POST** `/api/v1/process-vm-diff`

Compares vCenter and Jira VMs, finds missing VMs and prepares them for Jira Asset Manager.

**Request Body:**
```json
{
  "jira_config": {
    "api_url": "https://jira-support.company.com/rest/insight/1.0/object/navlist/iql",
    "token": "token_here",
    "object_type_id": "3191",
    "object_schema_id": "242"
  }
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/process-vm-diff" \
     -H "Content-Type: application/json" \
     -d '{
       "jira_config": {
         "api_url": "https://jira-support.company.com/rest/insight/1.0/object/navlist/iql",
         "token": "token_here",
         "object_type_id": "3191",
         "object_schema_id": "242"
       }
     }'
```

**Response:**
```json
{
  "status": "success",
  "message": "15 missing VMs processed successfully",
  "total_vcenter_vms": 1500,
  "total_jira_vms": 2002,
  "missing_vms_count": 15,
  "processed_missing_vms": 15,
  "errors": 0,
  "processing_time": 5.2
}
```

#### 3.2 Process VM Diff (Async)
**POST** `/api/v1/process-vm-diff-async`

Same as above but runs as background task.

---

### 4. Data Retrieval - vCenter VMs

#### 4.1 Get All vCenter VMs
**GET** `/api/v1/get-all-vms-from-db`

Retrieves VMs from vCenter collection with pagination and filtering.

**Query Parameters:**
- `skip` (int): Number of VMs to skip (default: 0)
- `limit` (int): Maximum VMs to return (default: 1000, max: 5000)
- `search` (string): Search query for VM name, hostname, IP
- `tag_category` (string): Filter by tag category
- `tag_value` (string): Filter by tag value

**cURL Examples:**
```bash
# Get first 100 VMs
curl "http://localhost:8000/api/v1/get-all-vms-from-db?limit=100"

# Search VMs
curl "http://localhost:8000/api/v1/get-all-vms-from-db?search=web-server"

# Filter by tag
curl "http://localhost:8000/api/v1/get-all-vms-from-db?tag_category=Environment&tag_value=Production"

# Pagination
curl "http://localhost:8000/api/v1/get-all-vms-from-db?skip=1000&limit=500"
```

**Response:**
```json
{
  "status": "success",
  "message": "Retrieved 100 VMs",
  "total_count": 1500,
  "vms": [
    {
      "name": "web-server-01",
      "vmid": "vm-1234",
      "uuid": "5047c2c8-...",
      "power_state": "poweredOn",
      "cpu_count": 4,
      "memory_gb": 16.0,
      "ip_address": "192.168.1.100",
      "guest_os": "Ubuntu Linux (64-bit)",
      "tags": [
        {
          "Environment": "Production",
          "Team": "WebTeam"
        }
      ],
      "tags_jira_asset": [
        {
          "Environment": "Production",
          "Team": "WebTeam"
        }
      ]
    }
  ]
}
```

#### 4.2 Get Single VM by Identifier
**GET** `/api/v1/vm/{identifier}`

Get single VM by UUID or vmid.

**cURL Examples:**
```bash
# By UUID
curl "http://localhost:8000/api/v1/vm/5047c2c8-1234-5678-9abc-def012345678"

# By vmid
curl "http://localhost:8000/api/v1/vm/vm-1234"
```

**Response:**
```json
{
  "status": "success",
  "message": "VM found successfully",
  "data": {
    "name": "web-server-01",
    "uuid": "5047c2c8-1234-5678-9abc-def012345678",
    "vmid": "vm-1234",
    "power_state": "poweredOn"
  }
}
```

---

### 5. Data Retrieval - Jira VMs

#### 5.1 Get All Jira VMs
**GET** `/api/v1/get-all-jira-vms-from-db`

Retrieves VMs from Jira Asset Management collection.

**Query Parameters:**
- `skip` (int): Number of VMs to skip (default: 0)
- `limit` (int): Maximum VMs to return (default: 1000, max: 5000)

**cURL Examples:**
```bash
# Get first 100 Jira VMs
curl "http://localhost:8000/api/v1/get-all-jira-vms-from-db?limit=100"

# Pagination
curl "http://localhost:8000/api/v1/get-all-jira-vms-from-db?skip=500&limit=250"
```

**Response:**
```json
{
  "status": "success", 
  "message": "Retrieved 100 Jira VMs",
  "total_count": 2002,
  "vms": [
    {
      "name": "bbz-odin-prod-rabbit01.company.com",
      "jira_object_id": "1449891",
      "jira_object_key": "ITAM-1449891",
      "vm_name": "bbz-odin-prod-rabbit01",
      "ip_address": "10.1.1.100",
      "cpu_count": 8,
      "memory_gb": 32,
      "disk_gb": 500,
      "operating_system": "RHEL",
      "site": "Main",
      "environment": "Production"
    }
  ]
}
```

---

### 6. Data Retrieval - Missing VMs

#### 6.1 Get All Missing VMs
**GET** `/api/v1/get-all-missing-vms-from-db`

Retrieves VMs that exist in vCenter but not in Jira.

**Query Parameters:**
- `skip` (int): Number of VMs to skip (default: 0) 
- `limit` (int): Maximum VMs to return (default: 1000, max: 5000)

**cURL Example:**
```bash
curl "http://localhost:8000/api/v1/get-all-missing-vms-from-db?limit=50"
```

**Response:**
```json
{
  "status": "success",
  "message": "Retrieved 15 missing VMs", 
  "total_count": 15,
  "vms": [
    {
      "vm_name": "new-test-server",
      "jira_asset_payload": {
        "objectTypeId": "3191",
        "attributes": [
          {
            "objectTypeAttributeId": 14590,
            "objectAttributeValues": [{"value": "new-test-server"}]
          }
        ]
      },
      "vm_summary": {
        "name": "new-test-server",
        "cpu": 4,
        "memory": 8,
        "disk": 100,
        "ip": "192.168.1.200"
      },
      "status": "pending_creation",
      "created_date": "2025-08-01T10:30:00Z"
    }
  ]
}
```

---

### 7. Database Management

#### 7.1 Delete All vCenter VMs
**DELETE** `/api/v1/delete-all-vms-from-db`

Deletes all VMs from vCenter collection.

**cURL Example:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/delete-all-vms-from-db"
```

**Response:**
```json
{
  "status": "success",
  "message": "Successfully deleted 1500 VMs",
  "deleted_count": 1500
}
```

#### 7.2 Delete All Jira VMs
**DELETE** `/api/v1/delete-all-jira-vms-from-db`

Deletes all VMs from Jira collection.

**cURL Example:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/delete-all-jira-vms-from-db"
```

#### 7.3 Delete All Missing VMs
**DELETE** `/api/v1/delete-all-missing-vms-from-db`

Deletes all missing VMs from collection.

**cURL Example:**
```bash  
curl -X DELETE "http://localhost:8000/api/v1/delete-all-missing-vms-from-db"
```

---

### 8. Statistics and Monitoring

#### 8.1 Get vCenter VM Statistics
**GET** `/api/v1/statistics`

Get comprehensive statistics for vCenter VMs.

**cURL Example:**
```bash
curl "http://localhost:8000/api/v1/statistics"
```

**Response:**
```json
{
  "status": "success",
  "message": "Statistics retrieved successfully",
  "data": {
    "total_vms": 1500,
    "power_state_distribution": {
      "poweredOn": 1200,
      "poweredOff": 250,
      "suspended": 50
    },
    "top_guest_os": [
      {"os": "Ubuntu Linux (64-bit)", "count": 400},
      {"os": "Windows Server 2019", "count": 350},
      {"os": "Red Hat Enterprise Linux 8", "count": 300}
    ],
    "top_hosts": [
      {"host": "esxi-host-01.company.com", "count": 200},
      {"host": "esxi-host-02.company.com", "count": 180}
    ]
  }
}
```

#### 8.2 Get Jira VM Statistics  
**GET** `/api/v1/jira-statistics`

Get comprehensive statistics for Jira VMs.

**cURL Example:**
```bash
curl "http://localhost:8000/api/v1/jira-statistics"
```

**Response:**
```json
{
  "status": "success",
  "message": "Jira VM statistics retrieved successfully",
  "data": {
    "total_jira_vms": 2002,
    "top_operating_systems": [
      {"os": "RHEL", "count": 800},
      {"os": "Windows", "count": 600},
      {"os": "Ubuntu", "count": 400}
    ],
    "top_sites": [
      {"site": "Main", "count": 1500},
      {"site": "DR", "count": 502}
    ],
    "top_platforms": [
      {"platform": "VMware", "count": 1800},
      {"platform": "Physical", "count": 202}
    ]
  }
}
```

#### 8.3 Get Collection Status
**GET** `/api/v1/collection-status`

Get overall collection status for all systems.

**cURL Example:**
```bash
curl "http://localhost:8000/api/v1/collection-status"
```

**Response:**
```json
{
  "status": "success",
  "message": "Collection status retrieved",
  "data": {
    "vcenter": {
      "status": "success",
      "vm_count": 1500,
      "statistics": {
        "total_vms": 1500,
        "power_state_distribution": {
          "poweredOn": 1200
        }
      },
      "last_check": "2025-08-01T10:00:00Z"
    },
    "jira": {
      "status": "success", 
      "jira_vm_count": 2002,
      "jira_statistics": {
        "total_jira_vms": 2002
      },
      "last_check": "2025-08-01T10:00:00Z"
    },
    "missing_vms_count": 15
  }
}
```

#### 8.4 Health Check
**GET** `/api/v1/health`

Application health check endpoint.

**cURL Example:**
```bash
curl "http://localhost:8000/api/v1/health"
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected", 
  "vcenter_vm_count": 1500,
  "jira_vm_count": 2002,
  "missing_vm_count": 15,
  "timestamp": "2025-08-01T10:00:00Z"
}
```

#### 8.5 Root Health Check
**GET** `/health`

Simple health check endpoint.

**cURL Example:**
```bash
curl "http://localhost:8000/health"
```

---

## 9. Jira Asset Posting

### 9.1 Post VMs to Jira Asset Management (Sync)
**POST** `/api/v1/post-to-jira`

Posts missing VMs from MongoDB to Jira Asset Management system. Creates VM assets using pre-generated payloads from the diff processor.

**Request Body:**
```json
{
  "jira_config": {
    "jira_token": "your_bearer_token",
    "create_url": "https://jira-support.company.com/rest/insight/1.0/object/create",
    "delay_seconds": 1.0
  },
  "limit": 10,
  "retry_failed": false,
  "max_retries": 3
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/post-to-jira" \
     -H "Content-Type: application/json" \
     -d '{
       "jira_config": {
         "jira_token": "your_token_here",
         "delay_seconds": 2.0
       },
       "limit": 5
     }'
```

**Response:**
```json
{
  "status": "success",
  "message": "3 VMs posted successfully to Jira, 2 failed",
  "processed": 5,
  "successful": 3,
  "failed": 2,
  "processing_time": 12.5,
  "results": [
    {
      "vm_name": "test-server-01",
      "status": "success",
      "object_key": "ITAM-1234567",
      "message": "Created as ITAM-1234567"
    },
    {
      "vm_name": "test-server-02", 
      "status": "failed",
      "error": "Validation error: Invalid CPU count",
      "status_code": 400,
      "message": "Failed: Validation error: Invalid CPU count"
    }
  ]
}
```

### 9.2 Post VMs to Jira Asset Management (Async)
**POST** `/api/v1/post-to-jira-async`

Same as above but runs as background task.

**cURL Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/post-to-jira-async" \
     -H "Content-Type: application/json" \
     -d '{
       "jira_config": {
         "jira_token": "your_token_here"
       },
       "limit": 100
     }'
```

**Response:**
```json
{
  "status": "accepted",
  "message": "Jira Asset posting background task started. Check logs for progress.",
  "processed": 0,
  "successful": 0,
  "failed": 0
}
```

---

## 10. Jira Asset Management - Data Retrieval

### 10.1 Get Completed Jira Assets
**GET** `/api/v1/completed-jira-assets`

Retrieve successfully created Jira assets.

**Query Parameters:**
- `skip` (int): Number of assets to skip (default: 0)
- `limit` (int): Maximum assets to return (default: 100, max: 1000)

**cURL Examples:**
```bash
# Get first 10 completed assets
curl "http://localhost:8000/api/v1/completed-jira-assets?limit=10"

# Pagination
curl "http://localhost:8000/api/v1/completed-jira-assets?skip=10&limit=20"
```

**Response:**
```json
{
  "status": "success",
  "message": "Retrieved 10 completed assets",
  "total_count": 25,
  "assets": [
    {
      "vm_name": "web-server-01",
      "jira_object_key": "ITAM-1234567",
      "status": "completed",
      "jira_post_date": "2025-08-01T10:30:00Z",
      "processing_completed": true,
      "jira_response": {
        "objectKey": "ITAM-1234567",
        "id": "1234567"
      },
      "vm_summary": {
        "name": "web-server-01",
        "cpu": 4,
        "memory": 8,
        "disk": 100,
        "ip": "192.168.1.100"
      },
      "debug_info": {
        "system_itam": "ITAM-5001",
        "component_itam": "ITAM-6001",
        "processing_date": "2025-08-01T10:25:00Z"
      }
    }
  ]
}
```

### 10.2 Get Failed Jira Assets
**GET** `/api/v1/failed-jira-assets`

Retrieve failed Jira asset creation attempts.

**Query Parameters:**
- `skip` (int): Number of assets to skip (default: 0)
- `limit` (int): Maximum assets to return (default: 100, max: 1000)

**cURL Example:**
```bash
curl "http://localhost:8000/api/v1/failed-jira-assets?limit=5"
```

**Response:**
```json
{
  "status": "success",
  "message": "Retrieved 5 failed assets",
  "total_count": 5,
  "assets": [
    {
      "vm_name": "problematic-vm",
      "status": "failed",
      "failure_reason": "Authorization failed - token invalid",
      "failure_status_code": 401,
      "retry_count": 2,
      "failure_date": "2025-08-01T11:15:00Z",
      "last_attempt": "2025-08-01T11:15:00Z",
      "vm_summary": {
        "name": "problematic-vm",
        "cpu": 2,
        "memory": 4,
        "disk": 50
      },
      "jira_asset_payload": {
        "objectTypeId": "3191",
        "attributes": [
          {
            "objectTypeAttributeId": 14590,
            "objectAttributeValues": [{"value": "problematic-vm"}]
          }
        ]
      }
    }
  ]
}
```

---

## 11. Jira Asset Statistics and Monitoring

### 11.1 Get Jira Poster Statistics
**GET** `/api/v1/jira-poster-stats`

Get comprehensive statistics about Jira posting process.

**cURL Example:**
```bash
curl "http://localhost:8000/api/v1/jira-poster-stats"
```

**Response:**
```json
{
  "pending_vms": 15,
  "failed_vms": 5,
  "completed_vms": 25,
  "total_processed": 30,
  "failed_vm_details": [
    {
      "vm_name": "problematic-vm-01",
      "retry_count": 2,
      "failure_reason": "Validation error: Missing required field"
    },
    {
      "vm_name": "auth-failed-vm",
      "retry_count": 1,
      "failure_reason": "Authorization failed - token invalid"
    }
  ],
  "last_check": "2025-08-01T12:00:00Z"
}
```

---

## 12. Jira Asset Retry Operations

### 12.1 Retry Failed Jira Posts
**POST** `/api/v1/retry-failed-jira-posts`

Retry previously failed Jira asset creations that haven't exceeded retry limits.

**Query Parameters:**
- `max_retries` (int): Maximum retry attempts (default: 3, range: 1-10)
- `jira_token` (string): Optional override for Jira Bearer token
- `create_url` (string): Optional override for Jira create URL

**cURL Examples:**
```bash
# Basic retry with default settings
curl -X POST "http://localhost:8000/api/v1/retry-failed-jira-posts"

# Retry with custom parameters
curl -X POST "http://localhost:8000/api/v1/retry-failed-jira-posts?max_retries=5&jira_token=new_token_here"

# Retry with custom URL
curl -X POST "http://localhost:8000/api/v1/retry-failed-jira-posts?create_url=https://custom-jira.company.com/rest/insight/1.0/object/create"
```

**Response:**
```json
{
  "status": "success",
  "message": "2 VMs posted successfully to Jira, 1 failed",
  "processed": 3,
  "successful": 2,
  "failed": 1,
  "processing_time": 8.2,
  "results": [
    {
      "vm_name": "retry-vm-01",
      "status": "success",
      "object_key": "ITAM-9876543",
      "message": "Created as ITAM-9876543"
    },
    {
      "vm_name": "still-failing-vm",
      "status": "failed",
      "error": "Validation error: Invalid memory value",
      "status_code": 400,
      "message": "Failed: Validation error: Invalid memory value"
    }
  ]
}
```

---

## 13. Jira Asset Database Management

### 13.1 Delete Completed Jira Assets
**DELETE** `/api/v1/delete-completed-jira-assets`

Delete all completed Jira asset records from database.

**cURL Example:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/delete-completed-jira-assets"
```

**Response:**
```json
{
  "status": "success",
  "message": "Successfully deleted 25 completed Jira assets",
  "deleted_count": 25
}
```

### 13.2 Delete Failed Jira Assets
**DELETE** `/api/v1/delete-failed-jira-assets`

Delete all failed Jira asset records from database.

**cURL Example:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/delete-failed-jira-assets"
```

**Response:**
```json
{
  "status": "success",
  "message": "Successfully deleted 5 failed Jira assets",
  "deleted_count": 5
}
```

---

## 🔄 Complete Workflow Examples

### Basic Data Collection Workflow

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

### Complete Jira Asset Workflow

```bash
# Step 1: Check current missing VMs
curl "http://localhost:8000/api/v1/get-all-missing-vms-from-db?limit=10"

# Step 2: Check Jira poster statistics
curl "http://localhost:8000/api/v1/jira-poster-stats"

# Step 3: Test posting with a small batch
curl -X POST "http://localhost:8000/api/v1/post-to-jira" \
     -H "Content-Type: application/json" \
     -d '{
       "jira_config": {
         "jira_token": "your_token_here",
         "delay_seconds": 1.5
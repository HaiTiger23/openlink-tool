# Luồng xử lý dữ liệu

## Input Processing
1. Manual Input:
   - Validate URL format
   - Remove duplicates
   - Normalize URLs

2. File Input:
   - Read .txt file
   - Parse line by line
   - Validate each URL
   - Handle encoding

## Link Checking Process
1. Single Link:
   - Initialize browser/page
   - Apply proxy (if configured)
   - Navigate to URL
   - Wait for network idle
   - Check content
   - Calculate time taken
   - Update UI

2. Batch Processing:
   - Create cluster
   - Set concurrency limit
   - Queue all selected links
   - Monitor progress
   - Aggregate results

## Output Handling
1. CSV Export:
   - Columns: URL, Status, Time, Timestamp
   - UTF-8 encoding
   - Quote handling
   - Header row

2. JSON Export:
   - Full link data
   - Status history
   - Timing data
   - Proxy information (optional)

## Status Management
1. Link States:
   - Pending
   - Processing
   - Success
   - Failed
   - Error

2. UI Updates:
   - Real-time status
   - Progress indicators
   - Error messages
   - Time tracking

## Proxy Integration
1. Configuration:
   - Manual proxy input
   - Proxy list import
   - Proxy rotation settings

2. Validation:
   - Test connection
   - Authentication
   - Response time
   - Availability check

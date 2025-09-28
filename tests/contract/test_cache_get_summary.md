# GET /cache Contract Test Summary

## Test Location
`/Users/a1234/www/xagi-mcp-aicoding-template-specify/tests/contract/cache_get.test.js`

## Test Status
❌ **Failing** - All 13 tests fail as expected because the GET /cache endpoint is not implemented yet.

## Test Overview
This contract test validates the expected behavior of the GET /cache endpoint, which should return cached template information with metadata and filtering capabilities.

## Test Categories

### 1. Success Scenarios (6 tests)
- **should return 200 status code**: Validates the endpoint responds with HTTP 200
- **should return array of cached templates**: Verifies the response contains an array of cached template objects
- **should show cache metadata**: Ensures cache metadata (total size, entry count, access count, last updated) is included
- **should support filtering by template**: Tests filtering cached templates by template name
- **should support filtering by version**: Tests filtering cached templates by version
- **should support sorting by different fields**: Tests sorting by name, size, accessCount, and lastAccessed

### 2. Error Scenarios (3 tests)
- **should handle cache service errors gracefully**: Tests 500 error handling when cache service fails
- **should handle invalid filter parameters**: Tests 400 error handling for invalid query parameters
- **should handle invalid sort parameters**: Tests 400 error handling for invalid sort fields

### 3. Response Format Validation (2 tests)
- **should return proper JSON format**: Validates response structure and JSON format
- **should include pagination information**: Tests pagination support with page/limit parameters

### 4. Performance and Edge Cases (2 tests)
- **should handle empty cache**: Tests behavior when no cached templates exist
- **should handle large cache responses efficiently**: Tests performance with 1000 cache entries

## Expected Response Format
```json
{
  "cachedTemplates": [
    {
      "id": "template-name@version",
      "name": "Template Display Name",
      "version": "1.0.0",
      "size": 2048,
      "accessCount": 5,
      "lastAccessed": "2024-01-01T12:00:00.000Z",
      "cachedAt": "2024-01-01T10:00:00.000Z",
      "path": "/path/to/cached/template"
    }
  ],
  "metadata": {
    "totalSize": 6656,
    "totalEntries": 3,
    "totalAccessCount": 16,
    "lastUpdated": "2024-01-01T12:00:00.000Z"
  },
  "filters": {
    "applied": []
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 3,
    "totalPages": 1
  }
}
```

## Supported Query Parameters
- **template**: Filter by template name/ID
- **version**: Filter by template version
- **sortBy**: Sort by name, size, accessCount, or lastAccessed
- **page**: Pagination page number
- **limit**: Items per page

## Dependencies
- Jest for test framework
- Supertest for HTTP assertions
- Express for test server setup
- Mock cache service (not yet implemented)

## How to Run
```bash
# Run just this test
npm test -- tests/contract/cache_get.test.js

# Run all contract tests
npm run test:contract
```

## Implementation Requirements
To make these tests pass, the following needs to be implemented:
1. Cache service (`src/services/cacheService.js`) with `getCacheEntries()` and `getCacheStats()` methods
2. Express server with GET /cache endpoint
3. Query parameter parsing and validation
4. Cache data retrieval and formatting
5. Error handling for various scenarios
6. Pagination support
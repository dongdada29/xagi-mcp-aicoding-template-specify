const request = require('supertest');
let app;
let Registry;

// Try to load the app and Registry model - these will fail initially
try {
  app = require('../../../src/app');
} catch (error) {
  // App doesn't exist yet - test will fail
}

try {
  Registry = require('../../../src/models/Registry');
} catch (error) {
  // Registry model doesn't exist yet - test will fail
}

describe('POST /registries/sync', () => {
  const testRegistry = {
    id: 'test-registry-123',
    name: 'Test Registry',
    url: 'https://registry.npmjs.org',
    type: 'npm',
    status: 'active',
    lastSyncAt: null,
    syncCount: 0
  };

  const mockSyncResponse = {
    id: 'test-registry-123',
    name: 'Test Registry',
    url: 'https://registry.npmjs.org',
    type: 'npm',
    status: 'active',
    lastSyncAt: expect.any(String),
    syncCount: 1,
    packagesCount: 1234,
    packagesUpdated: 56,
    packagesNew: 12,
    packagesDeleted: 2,
    syncDuration: 2456,
    syncStatus: 'completed'
  };

  beforeEach(async() => {
    // Skip tests if app or Registry is not available
    if (!app || !Registry) {
      return;
    }

    // Clear any existing test data
    if (Registry && Registry.deleteMany) {
      await Registry.deleteMany({});
    }
  });

  test('should return 200 status code for successful sync', async() => {
    if (!app || !Registry) {
      throw new Error('Server not implemented - missing app or Registry model');
    }

    // This test will fail because the endpoint doesn't exist yet
    const response = await request(app)
      .post('/registries/sync')
      .send({ registryId: testRegistry.id });

    expect(response.status).toBe(200);
  });

  test('should return updated registry information', async() => {
    if (!app || !Registry) {
      throw new Error('Server not implemented - missing app or Registry model');
    }

    const response = await request(app)
      .post('/registries/sync')
      .send({ registryId: testRegistry.id });

    expect(response.body).toEqual(
      expect.objectContaining({
        id: testRegistry.id,
        name: testRegistry.name,
        type: testRegistry.type,
        status: testRegistry.status,
        lastSyncAt: expect.any(String),
        syncCount: expect.any(Number)
      })
    );
  });

  test('should handle network errors gracefully', async() => {
    if (!app || !Registry) {
      throw new Error('Server not implemented - missing app or Registry model');
    }

    // Test with invalid registry URL
    const response = await request(app)
      .post('/registries/sync')
      .send({ registryId: 'invalid-registry' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
        message: expect.any(String)
      })
    );
  });

  test('should update last sync timestamp', async() => {
    if (!app || !Registry) {
      throw new Error('Server not implemented - missing app or Registry model');
    }

    // Get the time before sync
    const beforeSync = new Date();

    const response = await request(app)
      .post('/registries/sync')
      .send({ registryId: testRegistry.id });

    expect(response.status).toBe(200);
    expect(response.body.lastSyncAt).toBeDefined();

    // Parse the sync timestamp and verify it's recent
    const syncTime = new Date(response.body.lastSyncAt);
    expect(syncTime.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
    expect(syncTime.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  test('should return sync status and statistics', async() => {
    if (!app || !Registry) {
      throw new Error('Server not implemented - missing app or Registry model');
    }

    const response = await request(app)
      .post('/registries/sync')
      .send({ registryId: testRegistry.id });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        syncStatus: expect.any(String),
        syncDuration: expect.any(Number),
        packagesCount: expect.any(Number),
        packagesUpdated: expect.any(Number),
        packagesNew: expect.any(Number),
        packagesDeleted: expect.any(Number)
      })
    );

    // Verify sync status is one of expected values
    expect(['completed', 'in_progress', 'failed', 'partial']).toContain(response.body.syncStatus);

    // Verify reasonable statistics
    expect(response.body.syncDuration).toBeGreaterThan(0);
    expect(response.body.packagesCount).toBeGreaterThanOrEqual(0);
    expect(response.body.packagesUpdated).toBeGreaterThanOrEqual(0);
    expect(response.body.packagesNew).toBeGreaterThanOrEqual(0);
    expect(response.body.packagesDeleted).toBeGreaterThanOrEqual(0);
  });

  test('should validate required registryId parameter', async() => {
    if (!app || !Registry) {
      throw new Error('Server not implemented - missing app or Registry model');
    }

    const response = await request(app)
      .post('/registries/sync')
      .send({}); // Missing registryId

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Validation Error',
        message: expect.stringContaining('registryId')
      })
    );
  });

  test('should handle non-existent registry', async() => {
    if (!app || !Registry) {
      throw new Error('Server not implemented - missing app or Registry model');
    }

    const response = await request(app)
      .post('/registries/sync')
      .send({ registryId: 'non-existent-registry-999' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Not Found',
        message: expect.stringContaining('registry')
      })
    );
  });

  test('should return 409 if sync already in progress', async() => {
    if (!app || !Registry) {
      throw new Error('Server not implemented - missing app or Registry model');
    }

    // Mock a scenario where sync is already in progress
    const response = await request(app)
      .post('/registries/sync')
      .send({ registryId: testRegistry.id });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: 'Conflict',
        message: expect.stringContaining('already in progress')
      })
    );
  });
});

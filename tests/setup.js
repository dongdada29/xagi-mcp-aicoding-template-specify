// Test setup file for Jest
const fs = require('fs-extra');
const path = require('path');

// Mock external dependencies that require network or file system
jest.mock('simple-git', () => ({
  __esModule: true,
  default: () => ({
    clone: jest.fn(),
    checkout: jest.fn(),
    clean: jest.fn(),
  }),
}));

jest.mock('ora', () => ({
  __esModule: true,
  default: () => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
  }),
}));

jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: jest.fn(),
  },
}));

// Global test utilities
global.createTempDir = async () => {
  const tempy = require('tempy');
  return tempy.directory();
};

global.createTempFile = async (content, filename = 'test.js') => {
  const tempy = require('tempy');
  const tempPath = tempy.file({ name: filename });
  await fs.writeFile(tempPath, content);
  return tempPath;
};

// Clean up after each test
afterEach(async () => {
  jest.clearAllMocks();
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.XAGI_CACHE_DIR = '/tmp/xagi-test-cache';
process.env.XAGI_LOG_LEVEL = 'error';
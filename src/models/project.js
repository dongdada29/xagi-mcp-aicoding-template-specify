/**
 * ProjectInstance Model
 * Represents a project instance created from a template
 */

const fs = require('fs');
const path = require('path');
const { validateProjectName, validateFilePath } = require('../utils/validation');

/**
 * ProjectInstance class representing a project created from a template
 */
class ProjectInstance {
  /**
   * Create a new ProjectInstance
   * @param {Object} config - Project configuration
   * @param {string} config.id - Unique project instance identifier
   * @param {string} config.projectName - Project name
   * @param {string} config.projectPath - Project file system path
   * @param {string} config.templateId - Template used for creation
   * @param {string} config.templateVersion - Template version used
   * @param {Object} config.configuration - Configuration used for creation
   * @param {Date} config.createdAt - Project creation timestamp
   * @param {string} config.status - Project status (creating, created, failed)
   * @param {Date} config.lastModified - Last modification timestamp
   * @param {number} config.size - Project size in bytes
   * @param {Array} config.files - List of created files
   */
  constructor(config = {}) {
    this.id = config.id || this.generateId();
    this.projectName = config.projectName || '';
    this.projectPath = config.projectPath || '';
    this.templateId = config.templateId || '';
    this.templateVersion = config.templateVersion || '1.0.0';
    this.configuration = config.configuration || {};
    this.createdAt = config.createdAt || new Date();
    this.status = config.status || 'creating';
    this.lastModified = config.lastModified || new Date();
    this.size = config.size || 0;
    this.files = config.files || [];

    // Validate the project instance
    this.validate();
  }

  /**
   * Generate a unique project ID
   * @returns {string} - Unique project ID
   */
  generateId() {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate the project instance
   * @throws {Error} - If validation fails
   */
  validate() {
    // Validate project name
    if (!this.projectName || typeof this.projectName !== 'string') {
      throw new Error('Project name is required and must be a string');
    }

    const nameValidation = validateProjectName(this.projectName);
    if (!nameValidation.isValid) {
      throw new Error(`Invalid project name: ${nameValidation.errors.join(', ')}`);
    }

    // Validate project path
    if (!this.projectPath || typeof this.projectPath !== 'string') {
      throw new Error('Project path is required and must be a string');
    }

    const pathValidation = validateFilePath(this.projectPath);
    if (!pathValidation.isValid) {
      throw new Error(`Invalid project path: ${pathValidation.errors.join(', ')}`);
    }

    // Validate template ID
    if (!this.templateId || typeof this.templateId !== 'string') {
      throw new Error('Template ID is required and must be a string');
    }

    // Validate template version
    if (!this.templateVersion || typeof this.templateVersion !== 'string') {
      throw new Error('Template version is required and must be a string');
    }

    // Validate status
    this.validateStatus(this.status);

    // Validate configuration
    if (typeof this.configuration !== 'object' || this.configuration === null) {
      throw new Error('Configuration must be an object');
    }

    // Validate dates
    if (!(this.createdAt instanceof Date) || isNaN(this.createdAt.getTime())) {
      throw new Error('Created date must be a valid Date object');
    }

    if (!(this.lastModified instanceof Date) || isNaN(this.lastModified.getTime())) {
      throw new Error('Last modified date must be a valid Date object');
    }

    // Validate size
    if (typeof this.size !== 'number' || this.size < 0) {
      throw new Error('Size must be a non-negative number');
    }

    // Validate files array
    if (!Array.isArray(this.files)) {
      throw new Error('Files must be an array');
    }
  }

  /**
   * Validate project status
   * @param {string} status - Status to validate
   * @throws {Error} - If status is invalid
   */
  validateStatus(status) {
    const validStatuses = ['creating', 'created', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  /**
   * Get current project status
   * @returns {string} - Current project status
   */
  getStatus() {
    return this.status;
  }

  /**
   * Get list of project files
   * @returns {Array} - List of project files
   */
  getFiles() {
    return [...this.files];
  }

  /**
   * Get project size
   * @returns {number} - Project size in bytes
   */
  getSize() {
    return this.size;
  }

  /**
   * Update project status
   * @param {string} newStatus - New project status
   * @throws {Error} - If status is invalid
   */
  updateStatus(newStatus) {
    this.validateStatus(newStatus);
    this.status = newStatus;
    this.lastModified = new Date();
  }

  /**
   * Add a file to the project
   * @param {Object} file - File object to add
   * @param {string} file.path - File path
   * @param {string} file.name - File name
   * @param {number} file.size - File size in bytes
   * @param {string} file.type - File type
   * @param {Date} file.createdAt - File creation timestamp
   * @throws {Error} - If file validation fails
   */
  addFile(file) {
    if (!file || typeof file !== 'object') {
      throw new Error('File must be an object');
    }

    if (!file.path || typeof file.path !== 'string') {
      throw new Error('File path is required and must be a string');
    }

    if (!file.name || typeof file.name !== 'string') {
      throw new Error('File name is required and must be a string');
    }

    if (typeof file.size !== 'number' || file.size < 0) {
      throw new Error('File size must be a non-negative number');
    }

    if (!file.type || typeof file.type !== 'string') {
      throw new Error('File type is required and must be a string');
    }

    if (!file.createdAt || !(file.createdAt instanceof Date)) {
      file.createdAt = new Date();
    }

    // Check if file already exists
    const existingFileIndex = this.files.findIndex(f => f.path === file.path);
    if (existingFileIndex !== -1) {
      // Update existing file
      this.files[existingFileIndex] = file;
    } else {
      // Add new file
      this.files.push(file);
    }

    // Update project size
    this.calculateTotalSize();
    this.lastModified = new Date();
  }

  /**
   * Calculate total project size from files
   */
  calculateTotalSize() {
    this.size = this.files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * Remove a file from the project
   * @param {string} filePath - Path of file to remove
   * @throws {Error} - If file not found
   */
  removeFile(filePath) {
    const fileIndex = this.files.findIndex(f => f.path === filePath);
    if (fileIndex === -1) {
      throw new Error(`File not found: ${filePath}`);
    }

    this.files.splice(fileIndex, 1);
    this.calculateTotalSize();
    this.lastModified = new Date();
  }

  /**
   * Check if a file exists in the project
   * @param {string} filePath - Path of file to check
   * @returns {boolean} - True if file exists
   */
  hasFile(filePath) {
    return this.files.some(f => f.path === filePath);
  }

  /**
   * Get file by path
   * @param {string} filePath - Path of file to get
   * @returns {Object|null} - File object or null if not found
   */
  getFile(filePath) {
    return this.files.find(f => f.path === filePath) || null;
  }

  /**
   * Update project configuration
   * @param {Object} newConfig - New configuration
   * @throws {Error} - If configuration is invalid
   */
  updateConfiguration(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') {
      throw new Error('Configuration must be an object');
    }

    this.configuration = { ...this.configuration, ...newConfig };
    this.lastModified = new Date();
  }

  /**
   * Check if project directory exists
   * @returns {boolean} - True if project directory exists
   */
  projectDirectoryExists() {
    try {
      return fs.existsSync(this.projectPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate actual project size from filesystem
   * @returns {Promise<number>} - Project size in bytes
   */
  async calculateActualSize() {
    if (!this.projectDirectoryExists()) {
      return 0;
    }

    try {
      const stats = await this.getDirectoryStats(this.projectPath);
      return stats.totalSize;
    } catch (error) {
      console.error('Error calculating project size:', error);
      return 0;
    }
  }

  /**
   * Get directory statistics
   * @param {string} dirPath - Directory path
   * @returns {Promise<Object>} - Directory statistics
   */
  async getDirectoryStats(dirPath) {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    let totalSize = 0;
    let fileCount = 0;

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subStats = await this.getDirectoryStats(fullPath);
        totalSize += subStats.totalSize;
        fileCount += subStats.fileCount;
      } else {
        const stats = await fs.promises.stat(fullPath);
        totalSize += stats.size;
        fileCount++;
      }
    }

    return { totalSize, fileCount };
  }

  /**
   * Serialize project to JSON
   * @returns {Object} - JSON representation of project
   */
  toJSON() {
    return {
      id: this.id,
      projectName: this.projectName,
      projectPath: this.projectPath,
      templateId: this.templateId,
      templateVersion: this.templateVersion,
      configuration: this.configuration,
      createdAt: this.createdAt.toISOString(),
      status: this.status,
      lastModified: this.lastModified.toISOString(),
      size: this.size,
      files: this.files.map(file => ({
        ...file,
        createdAt: file.createdAt.toISOString()
      }))
    };
  }

  /**
   * Create ProjectInstance from JSON
   * @param {Object} json - JSON representation of project
   * @returns {ProjectInstance} - New ProjectInstance instance
   * @throws {Error} - If JSON is invalid
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON: must be an object');
    }

    const config = {
      ...json,
      createdAt: new Date(json.createdAt),
      lastModified: new Date(json.lastModified),
      files: json.files.map(file => ({
        ...file,
        createdAt: new Date(file.createdAt)
      }))
    };

    return new ProjectInstance(config);
  }

  /**
   * Get project age in milliseconds
   * @returns {number} - Project age in milliseconds
   */
  getAge() {
    return Date.now() - this.createdAt.getTime();
  }

  /**
   * Get time since last modification in milliseconds
   * @returns {number} - Time since last modification in milliseconds
   */
  getTimeSinceLastModified() {
    return Date.now() - this.lastModified.getTime();
  }

  /**
   * Check if project is recently modified (within last hour)
   * @returns {boolean} - True if project is recently modified
   */
  isRecentlyModified() {
    return this.getTimeSinceLastModified() < 60 * 60 * 1000; // 1 hour
  }

  /**
   * Get project summary
   * @returns {Object} - Project summary
   */
  getSummary() {
    return {
      id: this.id,
      projectName: this.projectName,
      status: this.status,
      fileCount: this.files.length,
      size: this.size,
      templateId: this.templateId,
      templateVersion: this.templateVersion,
      age: this.getAge(),
      timeSinceLastModified: this.getTimeSinceLastModified()
    };
  }
}

module.exports = ProjectInstance;

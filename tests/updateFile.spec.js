const { messages } = require('elasticio-node');
const { AttachmentProcessor } = require('@elastic.io/component-commons-library');
const { Readable } = require('stream');

// Mock the util module
jest.mock('../lib/util', () => ({
  streamToBuffer: jest.fn().mockImplementation(async (stream) => {
    return Buffer.from('test-content');
  }),
  getUserAgent: jest.fn().mockReturnValue('test-user-agent'),
  initialUploadRequest: jest.fn().mockImplementation(async (params) => ({
    data: {
      fileId: params.fileId,
      uploadId: 'mock-upload-id',
      status: 'success'
    }
  })),
  streamUploadRequests: jest.fn().mockImplementation(async ({ fileBuffer, fileSize, ...params }) => {
    if (!fileBuffer || typeof fileBuffer.length !== 'number') {
      throw new Error('fileBuffer must be a Buffer');
    }
    return {};
  })
}));

// Mock FilestoreClient
jest.mock('../lib/filestoreClient', () => {
  const { ApiKeyRestClient } = jest.requireActual('@elastic.io/component-commons-library');
  
  return class MockFilestoreClient extends ApiKeyRestClient {
    constructor(emitter, cfg) {
      if (!emitter.logger) emitter.logger = { trace: () => {} };
      super(emitter, cfg);
      this.cfg = cfg;
      this.apiKeyHeaderName = 'api-key';
      this.apiKeyHeaderValue = cfg.apiKey;
    }

    makeRequest = jest.fn().mockImplementation(async (params) => ({
      data: {
        fileId: params.url.split('/').pop(),
        uploadId: 'mock-upload-id',
        status: 'success'
      }
    }));
  };
});

// Mock axios
jest.mock('axios', () => ({
  patch: jest.fn().mockResolvedValue({ data: { status: 'success' } })
}));

// Import after mocks are set up
const util = require('../lib/util');
const action = require('../lib/actions/updateFile');

describe('updateFile action', () => {
  let self, cfg, msg;

  beforeEach(() => {
    jest.clearAllMocks();
    
    self = {
      emit: jest.fn().mockImplementation(async (event, data) => Promise.resolve()),
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
      }
    };

    cfg = {
      apiKey: 'test-api-key',
      tenantId: 'test-tenant',
      resourceServerUrl: 'https://test.com'
    };

    msg = {
      body: {
        access: 'public',
        filePath: 'test.jpg',
        fileToUpdate: 'test-file-id'
      },
      attachments: {
        'test.jpg': {
          url: 'https://example.com/test.jpg'
        }
      },
      id: 'test-msg-id'
    };
  });

  it('should throw error if apiKey is missing', async () => {
    delete cfg.apiKey;
    await expect(action.process.call(self, msg, cfg))
      .rejects
      .toThrow('cfg.apiKey is required');
  });

  it('should throw error if tenantId is missing', async () => {
    delete cfg.tenantId;
    await expect(action.process.call(self, msg, cfg))
      .rejects
      .toThrow('cfg.tenantId is required');
  });

  it('should throw error if filePath is missing', async () => {
    delete msg.body.filePath;
    await expect(action.process.call(self, msg, cfg))
      .rejects
      .toThrow('filePath is required');
  });

  it('should throw error if access is invalid', async () => {
    msg.body.access = 'invalid';
    await expect(action.process.call(self, msg, cfg))
      .rejects
      .toThrow('access is required and needs to be one of "private", "public"');
  });

  it('should successfully update a file', async () => {
    // Create a proper readable stream mock
    const mockStream = new Readable({
      read() {
        this.push(Buffer.from('test-content'));
        this.push(null);
      }
    });

    // Mock getAttachment to return a stream
    jest.spyOn(AttachmentProcessor.prototype, 'getAttachment')
      .mockResolvedValue({ data: mockStream });

    await action.process.call(self, msg, cfg);

    // Verify getAttachment was called
    expect(AttachmentProcessor.prototype.getAttachment).toHaveBeenCalledTimes(1);
    expect(util.streamToBuffer).toHaveBeenCalledWith(mockStream);

    // Verify initialUploadRequest was called with correct params
    expect(util.initialUploadRequest).toHaveBeenCalledWith(expect.objectContaining({
      client: expect.any(Object),
      resourceServerUrl: cfg.resourceServerUrl,
      apiKey: cfg.apiKey,
      tenantId: cfg.tenantId,
      access: msg.body.access,
      filePath: msg.body.filePath,
      fileId: msg.body.fileToUpdate,
      logger: self.logger
    }));

    // Verify streamUploadRequests was called with correct params
    expect(util.streamUploadRequests).toHaveBeenCalledWith(expect.objectContaining({
      resourceServerUrl: cfg.resourceServerUrl,
      apiKey: cfg.apiKey,
      tenantId: cfg.tenantId,
      fileId: msg.body.fileToUpdate,
      fileBuffer: expect.any(Buffer),
      fileSize: expect.any(Number)
    }));

    // Verify emit was called with success message
    expect(self.emit).toHaveBeenCalledWith('data', expect.objectContaining({
      body: expect.objectContaining({
        message: expect.stringContaining('successfully updated file')
      })
    }));
  });

  it('should handle update errors gracefully', async () => {
    const error = new Error('Update failed');
    jest.spyOn(AttachmentProcessor.prototype, 'getAttachment')
      .mockRejectedValue(error);

    await expect(action.process.call(self, msg, cfg))
      .rejects
      .toThrow('Update failed');
    expect(self.logger.error).toHaveBeenCalledTimes(1);
    expect(self.emit).toHaveBeenCalledWith('end');
  });
}); 
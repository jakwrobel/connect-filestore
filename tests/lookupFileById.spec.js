const { messages } = require('elasticio-node');

// Mock FilestoreClient
const mockMakeRequest = jest.fn();
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

    makeRequest = mockMakeRequest.mockImplementation(async (params) => ({
      data: {
        fileId: 'mock-file-id',
        name: 'test.jpg',
        size: 1024,
        status: 'available'
      }
    }));
  };
});

const action = require('../lib/actions/lookupFileById');

describe('lookupFileById action', () => {
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
        fileToGet: 'test-file-id'
      }
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

  it('should throw error if resourceServerUrl is missing', async () => {
    delete cfg.resourceServerUrl;
    await expect(action.process.call(self, msg, cfg))
      .rejects
      .toThrow('cfg.resourceServerUrl is required');
  });

  it('should throw error if fileToGet is missing', async () => {
    delete msg.body.fileToGet;
    await expect(action.process.call(self, msg, cfg))
      .rejects
      .toThrow('msg.body.fileToGet is required');
  });

  it('should successfully lookup a file', async () => {
    await action.process.call(self, msg, cfg);

    // Verify makeRequest was called with correct params
    expect(mockMakeRequest).toHaveBeenCalledWith({
      url: `${cfg.resourceServerUrl}/api/v2/file/${msg.body.fileToGet}`,
      method: 'GET',
      headers: {
        'x-api-key': cfg.apiKey,
        'x-dxp-tenant': cfg.tenantId
      }
    });

    // Verify emit was called with the response data
    expect(self.emit).toHaveBeenCalledWith('data', expect.objectContaining({
      body: expect.objectContaining({
        data: expect.objectContaining({
          fileId: 'mock-file-id',
          name: 'test.jpg',
          size: 1024,
          status: 'available'
        })
      })
    }));
  });

  it('should handle lookup errors gracefully', async () => {
    const error = new Error('File not found');
    mockMakeRequest.mockRejectedValueOnce(error);

    await expect(action.process.call(self, msg, cfg))
      .rejects
      .toThrow(`Error occured in the Filestore component while trying to hit ${cfg.resourceServerUrl}/api/v2/file/${msg.body.fileToGet} url: ${error.message}`);
    expect(self.logger.error).toHaveBeenCalledTimes(1);
    expect(self.emit).toHaveBeenCalledWith('end');
  });
}); 
const { messages } = require("elasticio-node");
const {
  AttachmentProcessor,
} = require("@elastic.io/component-commons-library");
const action = require("../lib/actions/rawRequest");
const { Readable } = require("stream");

// Mock messages module to return predictable IDs
jest.mock("elasticio-node", () => ({
  messages: {
    newMessageWithBody: (body) => ({
      id: "test-msg-id",
      attachments: {},
      body,
      headers: {},
      metadata: {},
    }),
  },
}));

// Mock axios with a simple implementation that covers our test cases
jest.mock("axios", () => {
  const mockAxios = jest.fn().mockResolvedValue({ data: { status: 'success' } });
  mockAxios.get = jest.fn().mockResolvedValue({ data: { status: 'success' } });
  mockAxios.post = jest.fn().mockResolvedValue({ data: { status: 'success' } });
  mockAxios.patch = jest.fn().mockResolvedValue({ data: { status: 'success' } });
  return mockAxios;
});
const axios = require("axios");

// Mock the util module
jest.mock("../lib/util", () => ({
  streamToBuffer: jest.fn().mockImplementation(async (stream) => {
    return Buffer.from("test-content");
  }),
  getUserAgent: jest.fn().mockReturnValue("test-user-agent"),
  initialUploadRequest: jest.fn().mockImplementation(async (params) => {
    const fileId = params.fileId || "mock-file-id";
    return {
      data: {
        fileId,
        uploadId: "mock-upload-id",
        status: "success",
      },
    };
  }),
  streamUploadRequests: jest
    .fn()
    .mockImplementation(async ({ fileBuffer, fileSize, fileId, ...params }) => {
      if (!fileBuffer || typeof fileBuffer.length !== "number") {
        throw new Error("fileBuffer must be a Buffer");
      }
      return { fileId };
    }),
}));

// Mock FilestoreClient
const mockMakeRequest = jest.fn();
jest.mock("../lib/filestoreClient", () => {
  const { ApiKeyRestClient } = jest.requireActual(
    "@elastic.io/component-commons-library"
  );

  return class MockFilestoreClient extends ApiKeyRestClient {
    constructor(emitter, cfg) {
      if (!emitter.logger) emitter.logger = { trace: () => {} };
      super(emitter, cfg);
      this.cfg = cfg;
      this.apiKeyHeaderName = "api-key";
      this.apiKeyHeaderValue = cfg.apiKey;
    }

    makeRequest = mockMakeRequest.mockImplementation(async (params) => ({
      data: {
        message: "Request successful",
        ...params,
      },
    }));
  };
});

const util = require("../lib/util");

describe("rawRequest action", () => {
  let self, cfg, msg;

  beforeEach(() => {
    jest.clearAllMocks();

    self = {
      emit: jest
        .fn()
        .mockImplementation(async (event, data) => Promise.resolve()),
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      },
    };

    cfg = {
      apiKey: "test-api-key",
      tenantId: "test-tenant",
      resourceServerUrl: "https://test.com",
    };

    msg = {
      body: {
        requestType: "GET",
        url: "api/v2/files",
        customHeaders: {
          Accept: "application/json",
        },
      },
    };
  });

  it("should throw error if apiKey is missing", async () => {
    delete cfg.apiKey;
    await expect(action.process.call(self, msg, cfg)).rejects.toThrow(
      "cfg.apiKey is required"
    );
  });

  it("should throw error if tenantId is missing", async () => {
    delete cfg.tenantId;
    await expect(action.process.call(self, msg, cfg)).rejects.toThrow(
      "cfg.tenantId is required"
    );
  });

  it("should throw error if resourceServerUrl is missing", async () => {
    delete cfg.resourceServerUrl;
    await expect(action.process.call(self, msg, cfg)).rejects.toThrow(
      "cfg.resourceServerUrl is required"
    );
  });

  it("should throw error if requestType is missing", async () => {
    delete msg.body.requestType;
    await expect(action.process.call(self, msg, cfg)).rejects.toThrow(
      "msg.body.requestType is required"
    );
  });

  it("should throw error if url is missing for non-POST/PATCH requests", async () => {
    delete msg.body.url;
    await expect(action.process.call(self, msg, cfg)).rejects.toThrow(
      "msg.body.url is required"
    );
  });

  it("should successfully make a GET request", async () => {
    await action.process.call(self, msg, cfg);

    // Verify axios was called with correct params
    expect(axios).toHaveBeenCalledWith({
      method: "GET",
      url: `${cfg.resourceServerUrl}/${msg.body.url}`,
      headers: {
        "x-api-key": cfg.apiKey,
        "x-dxp-tenant": cfg.tenantId,
        Accept: "application/json",
      },
      data: undefined,
    });

    // Verify emit was called with the response data
    expect(self.emit).toHaveBeenCalledWith("data", expect.any(Object));
  });

  it("should successfully upload a file using storage", async () => {
    msg = {
      body: {
        requestType: "POST",
        useConnectStorage: true,
        access: "public",
        filePath: "test.jpg",
      },
      attachments: {
        "test.jpg": {
          url: "https://example.com/test.jpg",
        },
      },
      id: "test-msg-id",
    };

    // Create a proper readable stream mock
    const mockStream = new Readable({
      read() {
        this.push(Buffer.from("test-content"));
        this.push(null);
      },
    });

    // Mock getAttachment to return a stream
    jest
      .spyOn(AttachmentProcessor.prototype, "getAttachment")
      .mockResolvedValue({ data: mockStream });

    // Mock the initialUploadRequest to return a specific fileId
    const expectedFileId = "mock-file-id";
    util.initialUploadRequest.mockImplementationOnce(async () => ({
      fileId: expectedFileId,
      uploadId: "mock-upload-id",
      status: "success",
    }));

    await action.process.call(self, msg, cfg);

    // Verify the storage flow was used
    expect(util.initialUploadRequest).toHaveBeenCalled();
    expect(util.streamToBuffer).toHaveBeenCalled();
    expect(util.streamUploadRequests).toHaveBeenCalled();

    // Verify emit was called with success message
    expect(self.emit).toHaveBeenCalledWith(
      "data",
      {
        id: "test-msg-id",
        attachments: {},
        body: {
          message: `Successfully processed file ${expectedFileId}`,
          fileId: expectedFileId,
        },
        headers: {},
        metadata: {},
      }
    );
  });

  it("should successfully update a file using storage", async () => {
    const existingFileId = "existing-file-id";
    msg = {
      body: {
        requestType: "PATCH",
        useConnectStorage: true,
        access: "public",
        filePath: "test.jpg",
        fileToUpdate: existingFileId,
      },
      attachments: {
        "test.jpg": {
          url: "https://example.com/test.jpg",
        },
      },
      id: "test-msg-id",
    };

    // Create a proper readable stream mock
    const mockStream = new Readable({
      read() {
        this.push(Buffer.from("test-content"));
        this.push(null);
      },
    });

    // Mock getAttachment to return a stream
    jest
      .spyOn(AttachmentProcessor.prototype, "getAttachment")
      .mockResolvedValue({ data: mockStream });

    // Mock the initialUploadRequest to return the existing fileId
    util.initialUploadRequest.mockImplementationOnce(async () => ({
      fileId: existingFileId,
      uploadId: "mock-upload-id",
      status: "success",
    }));

    await action.process.call(self, msg, cfg);

    // Verify the storage flow was used with update parameters
    expect(util.initialUploadRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: existingFileId,
        requestType: "PATCH",
      })
    );
    expect(util.streamToBuffer).toHaveBeenCalled();
    expect(util.streamUploadRequests).toHaveBeenCalled();

    // Verify emit was called with success message
    expect(self.emit).toHaveBeenCalledWith(
      "data",
      {
        id: "test-msg-id",
        attachments: {},
        body: {
          message: `Successfully processed file ${existingFileId}`,
          fileId: existingFileId,
        },
        headers: {},
        metadata: {},
      }
    );
  });

  it("should handle request errors gracefully", async () => {
    const error = new Error("Request failed");
    axios.mockRejectedValueOnce(error);

    await expect(action.process.call(self, msg, cfg)).rejects.toThrow(
      `Error occurred in the Filestore component: ${error.message}`
    );
    expect(self.logger.error).toHaveBeenCalledTimes(1);
    expect(self.emit).toHaveBeenCalledWith("end");
  });

  it("should throw a wrapped error if streamToBuffer fails during storage upload", async () => {
    msg = {
      body: {
        requestType: "POST",
        useConnectStorage: true,
        access: "public",
        filePath: "test.jpg",
      },
      attachments: {
        "test.jpg": {
          url: "https://example.com/test.jpg",
        },
      },
      id: "test-msg-id",
    };

    // Mock getAttachment to return a stream
    const mockStream = new Readable({
      read() {
        this.push(Buffer.from("test-content"));
        this.push(null);
      },
    });
    jest.spyOn(AttachmentProcessor.prototype, "getAttachment")
      .mockResolvedValue({ data: mockStream });

    // Mock initialUploadRequest to succeed
    util.initialUploadRequest.mockImplementationOnce(async () => ({
      fileId: "mock-file-id",
      uploadId: "mock-upload-id",
      status: "success",
    }));

    // Make streamToBuffer throw
    util.streamToBuffer.mockImplementationOnce(async () => {
      throw new Error("Buffer conversion failed");
    });

    await expect(action.process.call(self, msg, cfg)).rejects.toThrow(
      "Error occurred in the Filestore component: Buffer conversion failed"
    );
  });
});

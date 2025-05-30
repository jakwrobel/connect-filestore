const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");
const {
  AttachmentProcessor,
} = require("@elastic.io/component-commons-library");
const axios = require("axios");
const {
  getUserAgent,
  initialUploadRequest,
  streamUploadRequests,
  streamToBuffer
} = require("../util");

/**
 * Handles file upload through storage mechanism
 * @param {Object} params - The parameters for the sendDataThroughStorage operation
 * @param {string} params.apiKey - The API key for authentication
 * @param {string} params.tenantId - The tenant ID for the request
 * @param {string} params.resourceServerUrl - The base URL of the Filestore server
 * @param {string} params.access - The access level for the file ('private' or 'public')
 * @param {string} params.filePath - The target path/name for the file
 * @param {string} params.requestType - The type of request ('POST' or 'PATCH')
 * @param {string} params.fileToUpdate - The ID of the file to update (for PATCH requests)
 * @param {Object} params.client - The FilestoreClient instance
 * @param {Object} params.msg - The original message object containing attachments
 * @param {Object} params.customHeaders - Additional headers to include in the request
 * @param {Object} params.logger - Logger instance for debugging
 * @returns {Promise<string>} The ID of the processed file
 * @throws {Error} If there's an error during the storage operation
 */
const sendDataThroughStorage = async function ({
  apiKey,
  tenantId,
  resourceServerUrl,
  access,
  filePath,
  requestType,
  fileToUpdate,
  client,
  msg,
  customHeaders,
  logger,
}) {
  const attachmentName = Object.keys(msg.attachments)[0];
  const attachmentProcessor = new AttachmentProcessor(getUserAgent(), msg.id);
  let dataStream;

  try {
    dataStream = await attachmentProcessor.getAttachment(
      msg.attachments[attachmentName].url,
      "stream"
    );

    const initialResponse = await initialUploadRequest({
      resourceServerUrl,
      apiKey,
      tenantId,
      access,
      filePath,
      client,
      requestType,
      customHeaders,
      logger: this.logger,
      ...(fileToUpdate && { fileId: fileToUpdate }),
    });

    const { fileId } = initialResponse;
    const fileBuffer = await streamToBuffer(dataStream.data);

    await streamUploadRequests({
      resourceServerUrl,
      apiKey,
      tenantId,
      fileId,
      fileBuffer,
      fileSize: fileBuffer.length,
      logger,
      customHeaders,
    });

    return fileId;
  } catch (er) {
    throw new Error(`Error occurred in the Filestore component: ${er.message}`);
  }
};

/**
 * Processes raw requests to the Filestore API with support for file operations
 * @param {Object} msg - The incoming message containing request details
 * @param {Object} msg.body - The body of the message
 * @param {string} msg.body.requestType - The HTTP method to use (GET, POST, PATCH, etc.)
 * @param {Object} [msg.body.customHeaders] - Additional headers to include in the request
 * @param {Object} [msg.body.requestBody] - The body of the request for non-file operations
 * @param {string} msg.body.url - The endpoint URL (appended to resourceServerUrl)
 * @param {boolean} [msg.body.useConnectStorage] - Whether to use storage for file operations
 * @param {string} [msg.body.access] - The access level for file operations
 * @param {string} [msg.body.filePath] - The target path/name for file operations
 * @param {string} [msg.body.fileToUpdate] - The ID of the file to update
 * @param {Object} cfg - Configuration object containing API credentials
 * @param {string} cfg.apiKey - The API key for authentication
 * @param {string} cfg.tenantId - The tenant ID for the request
 * @param {string} cfg.resourceServerUrl - The base URL of the Filestore server
 * @returns {Promise<void>} Emits a message with the operation result
 * @throws {Error} If required parameters are missing or invalid
 * @example
 * // For a direct API call
 * await process({
 *   body: {
 *     requestType: 'GET',
 *     url: 'api/v2/files',
 *     customHeaders: { 'Accept': 'application/json' }
 *   }
 * }, {
 *   apiKey: 'key123',
 *   tenantId: 'tenant1',
 *   resourceServerUrl: 'https://api.example.com'
 * });
 * 
 * // For a customized file upload
 * await process({
 *   body: {
 *     requestType: 'POST',
 *     useConnectStorage: true,
 *     access: 'public',
 *     filePath: 'example.jpg'
 *   },
 *   attachments: { 'file': { url: 'https://example.com/file.jpg' } }
 * }, {
 *   apiKey: 'key123',
 *   tenantId: 'tenant1',
 *   resourceServerUrl: 'https://api.example.com'
 * });
 */
exports.process = async function process(msg, cfg) {
  const client = new FilestoreClient(this, cfg);
  const {
    requestType,
    customHeaders,
    requestBody,
    url,
    useConnectStorage,
    access,
    filePath,
    fileToUpdate,
  } = msg?.body;
  const { apiKey, tenantId, resourceServerUrl } = cfg;
  const requestTypeTransformed = requestType?.toUpperCase();

  this.logger.info("Executing rawRequest action");

  if (typeof apiKey !== "string") {
    throw new Error(
      `Error occurred in the Filestore component - cfg.apiKey is required and needs to be a string, the ${apiKey} was received`
    );
  }

  if (typeof tenantId !== "string") {
    throw new Error(
      `Error occurred in the Filestore component - cfg.tenantId is required and needs to be a string, the ${tenantId} was received`
    );
  }

  if (typeof resourceServerUrl !== "string") {
    throw new Error(
      `Error occurred in the Filestore component - cfg.resourceServerUrl is required and needs to be a string, the ${resourceServerUrl} was received`
    );
  }

  if (!requestType) {
    throw new Error(
      `msg.body.requestType is required, the ${requestType} was received in the filestore Component`
    );
  }

  if (
    !["POST", "PATCH"].includes(requestTypeTransformed) &&
    typeof url !== "string"
  ) {
    throw new Error(
      `msg.body.url is required and needs to be a string, the ${url} was received in the filestore Component`
    );
  }

  try {
    if (
      useConnectStorage &&
      (requestTypeTransformed === "POST" || requestTypeTransformed === "PATCH")
    ) {
      this.logger.info("Using storage for file upload/update");
      const fileId = await sendDataThroughStorage({
        apiKey,
        tenantId,
        resourceServerUrl,
        access,
        filePath,
        requestType: requestTypeTransformed,
        client,
        fileToUpdate,
        msg,
        customHeaders,
        logger: this.logger,
      });

      await this.emit(
        "data",
        messages.newMessageWithBody({
          message: `Successfully processed file ${fileId}`,
          fileId,
        })
      );
    } else {
      this.logger.info(
        "Making direct API request to:",
        `${resourceServerUrl}/${url}`
      );
      const result = await axios({
        method: requestTypeTransformed,
        url: `${resourceServerUrl}/${url}`,
        headers: {
          "x-api-key": apiKey,
          "x-dxp-tenant": tenantId,
          ...(customHeaders && customHeaders),
        },
        data: requestBody || undefined,
      });

      await this.emit("data", messages.newMessageWithBody(result.data));
    }
  } catch (er) {
    this.logger.error(
      `Error occurred in the Filestore component: ${er.message}`
    );
    await this.emit("end");
    throw new Error(`Error occurred in the Filestore component: ${er.message}`);
  }
};

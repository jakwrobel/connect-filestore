const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");
const axios = require("axios");
const {
  AttachmentProcessor,
} = require("@elastic.io/component-commons-library");
const { getUserAgent, initialUploadRequest, streamUploadRequests, streamToBuffer } = require("../util");

/**
 * Uploads a file to the Filestore using a resumable upload process
 * @param {Object} msg - The incoming message containing the file and metadata
 * @param {Object} msg.body - The body of the message
 * @param {string} msg.body.access - The access level for the file ('private' or 'public')
 * @param {string} msg.body.filePath - The target path/name for the file in the store
 * @param {Object} msg.attachments - The attachments object containing the file to upload
 * @param {Object} cfg - Configuration object containing API credentials
 * @param {string} cfg.apiKey - The API key for authentication
 * @param {string} cfg.tenantId - The tenant ID for the request
 * @param {string} cfg.resourceServerUrl - The base URL of the Filestore server
 * @returns {Promise<void>} Emits a message with the upload result
 * @throws {Error} If required parameters are missing or invalid
 * @example
 * await process({
 *   body: { access: 'public', filePath: 'example.jpg' },
 *   attachments: { 'file': { url: 'https://example.com/file.jpg' } }
 * }, {
 *   apiKey: 'key123',
 *   tenantId: 'tenant1',
 *   resourceServerUrl: 'https://api.example.com'
 * });
 */
exports.process = async function process(msg, cfg) {
  const { access, filePath } = msg?.body;
  const { apiKey, tenantId, resourceServerUrl } = cfg;
  
  this.logger.info("Executing uploadFile action");

  if (typeof apiKey !== "string") {
    throw new Error(
      `Error occured in the Filestore component - cfg.apiKey is required and needs to be a string, the ${apiKey} was received`
    );
  }

  if (typeof tenantId !== "string") {
    throw new Error(
      `Error occured in the Filestore component - cfg.tenantId is required and needs to be a string, the ${tenantId} was received`
    );
  }

  if (typeof resourceServerUrl !== "string") {
    throw new Error(
      `Error occured in the Filestore component - cfg.resourceServerUrl is required and needs to be a string, the ${resourceServerUrl} was received`
    );
  }

  if (typeof filePath !== "string") {
    throw new Error(
      `msg.body.filePath is required and needs to be a string, the ${filePath} was received in the filestore Component`
    );
  }

  if (!["private", "public"].includes(access)) {
    throw new Error(
      `Error occured in the Filestore component - msg.body.access is required and needs to be one of "private", "public"], the ${access} was received`
    );
  }

  try {
    const client = new FilestoreClient(this, cfg);
    const attachmentName = Object.keys(msg.attachments)[0];
    const attachmentProcessor = new AttachmentProcessor(getUserAgent(), msg.id);
    const dataStream = await attachmentProcessor.getAttachment(
      msg.attachments[attachmentName].url,
      "stream"
    );

    const initialResponse = await initialUploadRequest({
      client,
      resourceServerUrl,
      apiKey,
      tenantId,
      access,
      filePath,
      logger: this.logger,
    });
    const { fileId } = initialResponse;
    const fileBuffer = await streamToBuffer(dataStream.data);

    await streamUploadRequests({
      resourceServerUrl,
      apiKey,
      tenantId,
      fileId,
      fileBuffer: fileBuffer,
      fileSize: fileBuffer.length,
      logger: this.logger,
    });

    await this.emit(
      "data",
      messages.newMessageWithBody({
        message: `successfully uploaded file ${fileId}`,
      })
    );
  } catch (er) {
    this.logger.error(
      `Error occurred in the Filestore component: ${er.message}`
    );
    this.emit("end");
    throw new Error(`Error occured in the Filestore component: ${er.message}`);
  }
};

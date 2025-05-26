const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");

/**
 * Retrieves file metadata from the Filestore by its ID
 * @param {Object} msg - The incoming message containing the file ID
 * @param {Object} msg.body - The body of the message
 * @param {string} msg.body.fileToGet - The ID of the file to retrieve
 * @param {Object} cfg - Configuration object containing API credentials
 * @param {string} cfg.apiKey - The API key for authentication
 * @param {string} cfg.tenantId - The tenant ID for the request
 * @param {string} cfg.resourceServerUrl - The base URL of the Filestore server
 * @returns {Promise<void>} Emits a message with the file metadata
 * @throws {Error} If required parameters are missing or invalid, or if the file cannot be found
 * @example
 * await process({
 *   body: { fileToGet: 'file-123-abc' }
 * }, {
 *   apiKey: 'key123',
 *   tenantId: 'tenant1',
 *   resourceServerUrl: 'https://api.example.com'
 * });
 */
exports.process = async function process(msg, cfg) {
  const client = new FilestoreClient(this, cfg);
  const { fileToGet } = msg?.body;
  const { apiKey, tenantId, resourceServerUrl } = cfg;

  this.logger.info("Executing lookupFileById action");
  
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

  if (typeof fileToGet !== "string") {
    throw new Error(
      `Error occured in the Filestore component - msg.body.fileToGet is required and needs to be a string, the ${fileToGet} was received`
    );
  }

  try {
    const result = await client.makeRequest({
      url: `${resourceServerUrl}/api/v2/file/${fileToGet}`,
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "x-dxp-tenant": tenantId,
      },
    });

    await this.emit("data", messages.newMessageWithBody(result));
  } catch (er) {
    this.logger.error(
      `Error occurred in the Filestore component: ${er.message}`
    );
    this.emit("end");
    throw new Error(
      `Error occured in the Filestore component while trying to hit ${resourceServerUrl}/api/v2/file/${fileToGet} url: ${er.message}`
    );
  }
};

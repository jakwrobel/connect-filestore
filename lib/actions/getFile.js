const { messages } = require('elasticio-node');
const FilestoreClient = require('../filestoreClient');

// export const getFileStream = async (url, logger) => commons.axiosReqWithRetryOnServerError.call({ logger, cfg: {} }, {
//   method: 'GET',
//   url,
//   responseType: 'stream'
// });

/**
 * Executes the action's logic by sending a request to the
 * Filestore API and emitting response to the platform.
 * The function emits the results of the request to the platform as a message
 *
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  const client = new FilestoreClient(this, cfg);
  const { fileId } = msg?.query?.fileId

  this.logger.info(JSON.stringify(msg))

  if (!fileId) {
    throw new Error('Name is required');
  }

  const result = await client.makeRequest({
    url: `${cfg.resourceServerUrl}/api/v2/file/${fileId}/download`,
    method: 'GET',
    headers:{
      "x-api-key": cfg.apiKey,
      "x-dxp-tenant": cfg.tenantId
    }
  });

  await this.emit('data', messages.newMessageWithBody(result));
};
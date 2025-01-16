const { messages } = require('elasticio-node');
const FilestoreClient = require('../filestoreClient');

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
  const { fileId } = msg.body;

  this.logger.info(JSON.stringify(msg.query))

  if (!fileId) {
    throw new Error('Name is required');
  }

  const result = await client.makeRequest({
    url: `/api/v2/file/${msg.query.fileId}`,
    method: 'GET',
    headers:{
      "x-api-key": cfg.apiKey,
      "x-dxp-tenant": cfg.tenantId
    }
  });

  await this.emit('data', messages.newMessageWithBody(result));
};

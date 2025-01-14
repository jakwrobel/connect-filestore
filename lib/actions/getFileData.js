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
  // create a client object that has methods to make a request available to us
  const client = new FilestoreClient(this, cfg);
  const { fileId } = msg.body;

  if (!fileId) {
    throw new Error('Name is required');
  }

  this.logger.info('beforeMakeRequest')
  const result = await client.makeRequest({
    url: `api/v2/file/${fileId}`,
    method: 'GET',
    headers:{
      "x-api-key": cfg.apiKey,
      "x-dxp-tenant": cfg.tenantId
    }
  });
  this.logger.info('afterMakeRequest')
  this.logger.info(result)

  // this.emit is a function provided by sailor - we use it to emit messages to
  // our platform
  await this.emit('data', messages.newMessageWithBody(result));
  this.logger.info('afterEmitMessage')
};

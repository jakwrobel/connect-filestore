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
  const { data, access, source } = msg?.query

  if (typeof data !== "string") {
    throw new Error('msg.query.data is required');
  }

  if (typeof source !== "string") {
    throw new Error('msg.query.source is required');
  }

  const accessToSet = access ? access : "public"

  //Data to post in base64 format
  const base64Data= Buffer.from(data).toString('base64')

  const result = await client.makeRequest({
    url: `${cfg.resourceServerUrl}/api/v2/file`,
    method: 'POST',
    headers:{
      "x-api-key": cfg.apiKey,
      "x-dxp-tenant": cfg.tenantId
    },
    body:{
      "access":accessToSet,
      "data": base64Data,
      "source": msg.query.source
    }
  });

  await this.emit('data', messages.newMessageWithBody(result));
};

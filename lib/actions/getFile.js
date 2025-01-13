const { messages } = require('elasticio-node');
const FilestoreClient = require('../filestoreClient');

/**
 * Executes the action's logic by sending a request to the
 * Petstore API and emitting response to the platform.
 * The function emits the results of the request to the platform as a message
 *
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve triggers configuration values, such as apiKey and pet status
 * Emits results as a message to the platform
 */
exports.process = async function process(msg, cfg) {
  // create a client object that has methods to make a request available to us
  const client = new FilestoreClient(this, cfg);

  /**
   * The format of a message coming into the function is
   * msg: {
   *  body: {
   *      name:
   *      status:
   *   }
   * }
   * So we deconstruct the object accordingly
   */
  const { fileId } = msg.body;

  if (!fileId) {
    throw new Error('Name is required');
  }

  // create pet object to post
  // const pet = {
  //   name,
  //   status,
  // };

  // make a request using the client and save the result to a parameter =>
  // makeRequest takes an object with the necessary fields to complete the request
  const result = await client.makeRequest({
    url: `api/v2/file/${fileId}`,
    method: 'GET',
    headers:{
      "x-api-key": process.env.apiKey,
      "x-dxp-tenant": process.env.tenantId
    }
  });

  // this.emit is a function provided by sailor - we use it to emit messages to
  // our platform
  await this.emit('data', messages.newMessageWithBody(result));
};

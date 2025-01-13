const { messages } = require('elasticio-node');
const FilestoreClient = require('../filestoreClient');

/**
 * Executes the trigger's logic by sending a request to the
 * Petstore API and emitting response to the platform.
 * The function emits the results of the request to the platform as a message
 *
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve triggers configuration values, such as apiKey and pet status
 * Emits results as a message to the platform
 */
exports.process = async function getFile(msg, cfg) {
  const client = new FilestoreClient(this, cfg);

  // access the value of the status field defined in credentials section of component.json
  const { fileId } = cfg;

  if (!fileId) {
    throw new Error('File Id field is required');
  }

  // make a request using the client and save the result to a parameter
  const result = await client.makeRequest({
    url: `api/v2/file/${fileId}`,
    method: 'GET',
    headers:{
      "x-api-key": process.env.epiKey,
      "x-dxp-tenant": process.env.tenantId
    }
  });

  // emit result using supplied emit function
  await this.emit('data', messages.newMessageWithBody(result));
};

/**
 * getStatusModel is supplied in component.json as the model for credential statuses
 * The results of this function will dynamicaly provide the statuses from the API
 * to be displayd on the platform
 */
// exports.getStatusModel = async function getStatusModel(cfg) {
//   const client = new PetstoreClient(this, cfg);

//   const result = await client.makeRequest({
//     url: '/pet/statuses',
//     method: 'GET',
//   });

//   const statuses = {};

//   // map the statuses to a human readable form
//   result.forEach((status) => {
//     statuses[status] = status.charAt(0).toUpperCase() + status.substring(1);
//   });

//   return statuses;
// };

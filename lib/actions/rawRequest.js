const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");

/**
 * Executes the action's logic by sending a request to the
 * Filestore API and emitting response to the platform.
 * The function emits the results of the request to the platform as a message
 *
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  this.logger.info(JSON.stringify(msg));
  this.logger.info(JSON.stringify(cfg));
  const client = new FilestoreClient(this, cfg);
  const { requestType, customHeaders, dataToSend, requestBody, url } = msg?.body;

  if (!requestType) {
    throw new Error(
      `msg.body.requestType is required, the ${requestType} was received in the filestore Component`
    );
  }

  if (typeof url !== "string") {
    throw new Error(
      `msg.body.url is required and needs to be a string, the ${url} was received in the filestore Component`
    );
  }

  let result = ''
  try {
     result = await client.makeRequest({
      url: `${cfg.resourceServerUrl}/${url}`,
      method: `${requestType.toUpperCase()}`,
      headers: {
        "x-api-key": cfg.apiKey,
        "x-dxp-tenant": cfg.tenantId,
        ...customHeaders,
      },
      body: {
        ...requestBody,
      },
    });
  } catch (er) {
    throw new Error(
      `Error occeured while trying to hit ${
        cfg.resourceServerUrl
      }/${url} url: ${er.message}`
    );
  }

  await this.emit("data", messages.newMessageWithBody(result));
};

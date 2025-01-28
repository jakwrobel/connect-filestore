const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");

/**
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  const client = new FilestoreClient(this, cfg);
  const { requestType, customHeaders, requestBody, url } = msg?.body;
  const { apiKey, tenantId, resourceServerUrl } = cfg;

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

  try {
    const result = await client.makeRequest({
      url: `${resourceServerUrl}/${url}`,
      method: `${requestType.toUpperCase()}`,
      headers: {
        "x-api-key": apiKey,
        "x-dxp-tenant": tenantId,
        ...(customHeaders && customHeaders),
      },
      body: {
        ...(requestBody && requestBody),
      },
    });

    await this.emit("data", messages.newMessageWithBody(result));
  } catch (er) {
    throw new Error(
      `Error occured while trying to hit ${resourceServerUrl}/${url} url: ${er.message}`
    );
  }
};

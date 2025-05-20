const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");

/**
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  const client = new FilestoreClient(this, cfg);
  const { fileToGet } = msg?.body;
  const { apiKey, tenantId, resourceServerUrl } = cfg;
this.logger.info("The msg:",msg)
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
    throw new Error(
      `Error occured in the Filestore component while trying to hit ${resourceServerUrl}/api/v2/file/${fileToGet} url: ${er.message}`
    );
  }
};

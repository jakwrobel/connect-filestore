const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");

/**
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  const client = new FilestoreClient(this, cfg);
  const { fileToGet } = msg?.body;

  if (typeof fileToGet !== "string") {
    throw new Error(
      `msg.body.fileToGet is required and needs to be a string, the ${fileToGet} was received in the filestore Component`
    );
  }

  let result = "";
  try {
    result = await client.makeRequest({
      url: `${cfg.resourceServerUrl}/api/v2/file/${fileToGet}`,
      method: "GET",
      headers: {
        "x-api-key": cfg.apiKey,
        "x-dxp-tenant": cfg.tenantId,
      },
    });
  } catch (er) {
    throw new Error(
      `Error occured while trying to hit ${cfg.resourceServerUrl}/api/v2/file/${fileToGet} url: ${er.message}`
    );
  }

  await this.emit("data", messages.newMessageWithBody(result));
};

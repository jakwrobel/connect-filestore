const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");

/**
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  const client = new FilestoreClient(this, cfg);
  const { fileToDelete } = msg?.body;
  const { apiKey, tenantId } = cfg;

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

  if (typeof fileToDelete !== "string") {
    throw new Error(
      `Error occured in the Filestore component - cfg.fileToDelete is required and needs to be a string, the ${fileToDelete} was received`
    );
  }

  let result = "";
  try {
    result = await client.makeRequest({
      url: `${cfg.resourceServerUrl}/api/v2/file/${fileToDelete}`,
      method: "DELETE",
      headers: {
        "x-api-key": apiKey,
        "x-dxp-tenant": tenantId,
      },
    });
  } catch (er) {
    throw new Error(
      `Error occured in the Filestore component while trying to hit ${cfg.resourceServerUrl}/api/v2/file/${fileToDelete} url: ${er.message}`
    );
  }

  await this.emit("data", messages.newMessageWithBody(result));
};

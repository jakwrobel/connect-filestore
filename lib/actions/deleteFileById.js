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
  const client = new FilestoreClient(this, cfg);
  const { fileToDelete } = msg?.body;

  if (typeof fileToDelete !== "string") {
    throw new Error(
      `msg.body.fileToDelete is required and needs to be a string, the ${fileToDelete} was received in the filestore Component`
    );
  }

  let result = "";
  try {
    const result = await client.makeRequest({
      url: `${cfg.resourceServerUrl}/api/v2/file/${fileToDelete}`,
      method: "DELETE",
      headers: {
        "x-api-key": cfg.apiKey,
        "x-dxp-tenant": cfg.tenantId,
      },
    });
  } catch (er) {
    throw new Error(
      `Error occured while trying to hit ${cfg.resourceServerUrl}/api/v2/file/${fileToDelete} url: ${er.message}`
    );
  }

  await this.emit("data", messages.newMessageWithBody(result));
};

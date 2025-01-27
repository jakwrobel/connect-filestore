const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");

/**
 * This function will make the initial request to the LF endpoint to get the file ID.
 * @returns The response from the LF endpoint
 */
async function doInitialRequest({
  client,
  apiKey,
  tenantId,
  resourceServerUrl,
  access,
  source,
}) {
  // Make our initial request to the LF endpoint

  const response = await client.makeRequest({
    url: `${resourceServerUrl}/api/v2/file`,
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "x-dxp-tenant": tenantId,
    },
    body: {
      access: access,
      source: source,
      uploadType: "resumable",
    },
  });

  return response;
}

async function doStreamRequests({
  client,
  apiKey,
  tenantId,
  resourceServerUrl,
  fileId,
  fileBuffer,
  fileSize,
  externalThis  
}) {
  // Set the chunk size to 5MB
  const chunkSize = 5 * 1024 * 1024

  // Calculate the number of chunks we need to send
  const numberOfChunks = Math.ceil(fileSize / chunkSize);
  // Loop through the buffer and send the chunks
  for (let i = 0; i < numberOfChunks; i++) {
    // Extract the chunk from the buffer
    const chunkStart = i * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, fileSize);
    const chunk = fileBuffer.subarray(chunkStart, chunkEnd);
    // const chunkString = chunk.toString("base64")

    const config = {
      url: `${resourceServerUrl}/api/v2/file/${fileId}`,
      method: "PATCH",
      headers: {
        "x-api-key": apiKey,
        "x-dxp-tenant": tenantId,
        "content-type": "application/octet-stream",
        "content-range": `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`,
        "content-length": `${chunk.length}`
      },
      body: `${chunk}`,
    }

    externalThis.logger.info('function config', JSON.stringify(config))
    const result = await client.makeRequest(config);
    return result
  }
}

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
  const { data, access, source } = msg?.body;
  const initialResponse = await doInitialRequest({
    client,
    resourceServerUrl: cfg.resourceServerUrl,
    apiKey: cfg.apiKey,
    tenantId: cfg.tenantId,
    access,
    source,
  });
  const { fileId } = initialResponse;
  const that=this

  if (!data) {
    throw new Error(`msg.body.data is required, the ${data} was received in the filestore Component`);
  }

  if (typeof source !== "string") {
    throw new Error(`msg.body.source is required and needs to be a string, the ${source} was received in the filestore Component`);
  }

  if (typeof access !== "string") {
    throw new Error(`msg.body.access is required and needs to be a string, the ${access} was received in the filestore Component`);
  }

  // //Data to post in base64 format
  const dataBuffer = data && Buffer.from(data)
  const fileSize = dataBuffer.length;
  const result = await doStreamRequests({
    client,
    resourceServerUrl: cfg.resourceServerUrl,
    apiKey: cfg.apiKey,
    tenantId: cfg.tenantId,
    fileId,
    fileBuffer: dataBuffer,
    fileSize: fileSize,
    externalThis: that
  });

  await this.emit("data", messages.newMessageWithBody(result));
};

const { messages } = require('elasticio-node');
const FilestoreClient = require('../filestoreClient');

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
  fileToUpdate
}) {
  // Make our initial request to the LF endpoint

  const response = await client.makeRequest({
    url: `${resourceServerUrl}/api/v2/file/${fileToUpdate}`,
    method: "PATCH",
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
  this.logger.info(JSON.stringify(msg))
  this.logger.info(JSON.stringify(cfg))
  const client = new FilestoreClient(this, cfg);
  const { data, access, source, uploadType, fileToUpdate } = msg?.body

  if (!data) {
    throw new Error(`msg.body.data is required, the ${data} was received in the filestore Component`);
  }

  if (typeof source !== "string") {
    throw new Error(`msg.body.source is required and needs to be a string, the ${source} was received in the filestore Component`);
  }

  if (typeof fileToUpdate!== "string") {
    throw new Error(`msg.body.fileToUpdate is required, the ${fileToUpdate} was received in the filestore Component`);
  }

  if (typeof access !== "string") {
    throw new Error(`msg.body.access is required and needs to be a string, the ${access} was received in the filestore Component`);
  }

  if (typeof uploadType !== "string") {
    throw new Error(`msg.body.uploadType is required and needs to be a string, the ${uploadType} was received in the filestore Component`);
  }

  const initialResponse = await doInitialRequest({
    client,
    resourceServerUrl: cfg.resourceServerUrl,
    apiKey: cfg.apiKey,
    tenantId: cfg.tenantId,
    access,
    source,
    fileToUpdate
  });

  const dataBuffer = data && Buffer.from(data)
  const fileSize = dataBuffer.length;

  // const accessToSet = access ? access : "public"

  // //Data to post in base64 format
  // const base64Data= Buffer.from(data).toString('base64')
  // this.logger.info(JSON.stringify(access))
  // this.logger.info(JSON.stringify(data))
  // this.logger.info(JSON.stringify(base64Data))
  // this.logger.info(JSON.stringify(source))
  
  // const result = await client.makeRequest({
  //   url: `${cfg.resourceServerUrl}/api/v2/file/${fileToUpdate}`,
  //   method: 'PATCH',
  //   headers:{
  //     "x-api-key": cfg.apiKey,
  //     "x-dxp-tenant": cfg.tenantId
  //   },
  //   body:{
  //     "access":accessToSet,
  //     "data": base64Data,
  //     "source": source,
  //     "uploadType": uploadType
  //   }
  // });

  await this.emit('data', messages.newMessageWithBody({"result":"success"}));
};

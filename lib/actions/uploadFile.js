const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");
const axios = require("axios");
const { AttachmentProcessor } = require('@elastic.io/component-commons-library')
const { getUserAgent } = require('../util');

/**
 * This function will make the initial request to the Filestore endpoint to get the file ID.
 * @returns The response from the Filestore endpoint
 */
async function doInitialRequest({
  client,
  apiKey,
  tenantId,
  resourceServerUrl,
  access,
  filePath,
}) {
  const response = await client.makeRequest({
    url: `${resourceServerUrl}/api/v2/file`,
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "x-dxp-tenant": tenantId,
      "content-type": "application/json"
    },
    body: {
      access: access,
      source: filePath,
      uploadType: "resumable",
    },
  });

  return response;
}

async function doStreamRequests({
  apiKey,
  tenantId,
  resourceServerUrl,
  fileId,
  fileBuffer,
  fileSize,
  logger,
}) {
  // Set the chunk size to 5MB/ This is the required minimum, max is 50MB
  const chunkSize = 5 * 1024 * 1024;
  const numberOfChunks = Math.ceil(fileSize / chunkSize);

  for (let i = 0; i < numberOfChunks; i++) {
    const chunkStart = i * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, fileSize);
    const chunk = fileBuffer.subarray(chunkStart, chunkEnd);

    // Temporary axios is used, because elasticIO makeRequest works strange with the Patch requests
    // It adds a quotation mark before ont the beging of the data and deletes last character
    try{
    await axios.patch(`${resourceServerUrl}/api/v2/file/${fileId}`, chunk, {
      headers: {
        "x-api-key": apiKey,
        "x-dxp-tenant": tenantId,
        "content-type": "application/octet-stream",
        "content-range": `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`,
        "content-length": `${chunk.length}`,
      },
    })
  }catch (error) {
    logger.info(`Failed to upload chunk ${i + 1}/${numberOfChunks}. Error: ${error.message}`);
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
    } else if (error.request) {
      // The request was made but no response was received
      logger.info('No response received from server');
    }
    throw new Error(`Failed to upload chunk ${i + 1}/${numberOfChunks}: ${error.message}`);
  }
}
}

/**
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  const client = new FilestoreClient(this, cfg);
  const { data, access, filePath } = msg?.body;
  const { apiKey, tenantId, resourceServerUrl } = cfg;
let dataStream
const attachmentSize = msg.attachments["image.jpg"].size
const attachmentProcessor = new AttachmentProcessor(getUserAgent(), msg.id);
try {
  dataStream = await attachmentProcessor.getAttachment(msg.attachments["image.jpg"].url, 'stream')
} catch (err) {
  this.logger.error(`URL - "${msg.attachments["image.jpg"].url}" unreachable: ${err}`);
  this.emit('error', `URL - "${msg.attachments["image.jpg"].url}" unreachable: ${err}`)
  this.emit('end')
  return
}

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

  // if (!data) {
  //   throw new Error(
  //     `Error occured in the Filestore component - msg.body.data is required, the ${data} was received`
  //   );
  // }

  // if (typeof filePath !== "string") {
  //   throw new Error(
  //     `msg.body.filePath is required and needs to be a string, the ${filePath} was received in the filestore Component`
  //   );
  // }

  // if (!["private", "public"].includes(access)) {
  //   throw new Error(
  //     `Error occured in the Filestore component - msg.body.access is required and needs to be one of "private", "public"], the ${access} was received`
  //   );
  // }
  // const dataBuffer = Buffer.from(data);

  try {
    const initialResponse = await doInitialRequest({
      client,
      resourceServerUrl,
      apiKey: cfg.apiKey,
      tenantId: cfg.tenantId,
      access,
      filePath,
    });
    const { fileId } = initialResponse;
      const fileBuffer = Buffer.concat(dataStream.data._readableState.buffer)

      function streamToBuffer(stream) {
        return new Promise((resolve, reject) => {
          const chunks = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        });
      }
      
      const fileBuffer2 = await streamToBuffer(dataStream.data);
      this.logger.info('fileBuffer2', fileBuffer2)

      await doStreamRequests({
        client,
        resourceServerUrl,
        apiKey,
        tenantId,
        fileId,
        fileBuffer: fileBuffer2,
        fileSize: fileBuffer2.length,
        requestStartByte: 0,
        logger: this.logger,
        totalSize: attachmentSize
      });


    await this.emit(
      "data",
      messages.newMessageWithBody({
        message: `successfully uploaded file ${fileId}`,
      })
    );
  } catch (er) {
    throw new Error(`Error occured in the Filestore component: ${er.message}`);
  }
};

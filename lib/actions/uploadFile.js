const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");
const axios = require("axios");
const { AttachmentProcessor } = require('@elastic.io/component-commons-library')
const { getUserAgent } = require('../util');
const stream = require('stream')
const util = require('util')
const pipeline = util.promisify(stream.pipeline);
// import fs from "fs";
// import path from "path";

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
  client,
  apiKey,
  tenantId,
  resourceServerUrl,
  fileId,
  fileBuffer,
  fileSize,
  logger,
  requestStartByte,
  totalSize
}) {
  logger.info('executed')
  // Set the chunk size to 5MB/ This is the required minimum, max is 50MB
  const chunkSize = 5 * 1024 * 1024;

  // Calculate the number of chunks we need to send
  const numberOfChunks = Math.ceil(fileSize / chunkSize);
  logger.info('numberOfChunks',numberOfChunks)
  // Loop through the buffer and send the chunks
  for (let i = 0; i < numberOfChunks; i++) {
    // Extract the chunk from the buffer
    const chunkStart = i * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, fileSize);
    const chunk = fileBuffer.subarray(chunkStart, chunkEnd);
    // await client.makeRequest({
    //   url: `${resourceServerUrl}/api/v2/file/${fileId}`,
    //   method: "PATCH",
    //   headers: {
    //     "x-api-key": apiKey,
    //     "x-dxp-tenant": tenantId,
    //     "content-type": "application/octet-stream",
    //     "content-range": `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`,
    //     "content-length": `${chunk.length}`,
    //   },
    //   body: `${chunk}`,
    // });

    // Temporary axios is used, because elasticIO makeRequest works strange with the Patch requests
    // It adds a quotation mark before ont the beging of the data and deletes last character
    logger.info(`request, {
      "x-api-key": apiKey,
      "x-dxp-tenant": tenantId,
      "content-type": "application/octet-stream",
      "content-range": "bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}",
      "content-length": ${chunk.length},
    }`)
    logger.info('chunk',chunk)
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
      logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      logger.error(`Response status: ${error.response.status}`);
      logger.error(`Response headers: ${JSON.stringify(error.response.headers)}`);
    } else if (error.request) {
      // The request was made but no response was received
      logger.error('No response received from server');
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
this.logger.info('msg object',msg)
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
// const buffer = Buffer.alloc(5000);
// const file = fs.openSync(path.resolve(msg.attachments.url), "r");
// const bytesRead = fs.readSync(file, buffer, 0, 500, 1 * 100);
// this.logger.info('bytesRead',bytesRead)
let readableState = dataStream.data._readableState
if (readableState instanceof ReadableStream) {
  this.logger.info('This is ReadableStream');
} else if (readableState instanceof WritableStream) {
  this.logger.info('This is WritableStream');
} 
else if (readableState instanceof TransformStream){
  this.logger.info('This is TransformStream');
}
else {
  this.logger.info('This is something else');
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
// const base64Data = dataStream.data._readableState.buffer[0].toString('base64')
// this.logger.info('base64Data',base64Data)
  try {
    const initialResponse = await doInitialRequest({
      client,
      resourceServerUrl,
      apiKey: cfg.apiKey,
      tenantId: cfg.tenantId,
      access,
      filePath,
    });
this.logger.info('readableState.buffer length',dataStream.data._readableState.buffer.length)
    const { fileId } = initialResponse;
    this.logger.info("Array of buffers",dataStream.data._readableState.buffer)
      const fileBuffer = Buffer.concat(dataStream.data._readableState.buffer)
      this.logger.info('dataStream', dataStream)
      this.logger.info('dataStream.data', dataStream.data)
      this.logger.info('dataStream.data._readableState', dataStream.data._readableState)
      this.logger.info('attachmentSize', attachmentSize)
      this.logger.info('fileBuffer.length', fileBuffer.length)
      this.logger.info('fileBuffer', fileBuffer)

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
  
    // for (let i = 0; i < dataStream.data._readableState.buffer.length; i++) {
    //   const bufferEndByte = i===0 ? 0 : dataStream.data._readableState.buffer[i].length

    //   await doStreamRequests({
    //     client,
    //     resourceServerUrl,
    //     apiKey,
    //     tenantId,
    //     fileId,
    //     fileBuffer: dataStream.data._readableState.buffer[i],
    //     fileSize: dataStream.data._readableState.buffer[i].length,
    //     requestStartByte: bufferEndByte,
    //     logger: this.logger,
    //     totalSize: attachmentSize
    //   });
    // }

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

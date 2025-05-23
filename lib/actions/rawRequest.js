const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");
const {
  AttachmentProcessor,
} = require("@elastic.io/component-commons-library");
const axios = require("axios");
const {
  getUserAgent,
  initialUploadRequest,
  streamUploadRequests,
} = require("../util");

/**
 * Converts a readable stream to a Buffer by collecting all chunks of data
 * @param {import('stream').Readable} stream - The readable stream to be converted to a buffer
 * @returns {Promise<Buffer>} A promise that resolves with the complete buffer containing all stream data
 * @throws {Error} If there's an error while reading from the stream
 * @example
 * const buffer = await streamToBuffer(readableStream);
 */
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

const sendDataThroughStorage = async function({
  apiKey,
  tenantId,
  resourceServerUrl,
  access,
  filePath,
  requestType,
  fileToUpdate,
  client,
  msg,
  logger
}) {
  logger.info("sendDataThroughStorage executed")
  const attachmentName = Object.keys(msg.attachments)[0];
  const attachmentProcessor = new AttachmentProcessor(getUserAgent(), msg.id);
  let dataStream;

  try {
    dataStream = await attachmentProcessor.getAttachment(
      msg.attachments[attachmentName].url,
      "stream"
    );
    logger.info("beforeInitial1")
    logger.info('beforeInitial2',{
      resourceServerUrl,
      apiKey,
      tenantId,
      access,
      filePath,
      client,
      requestType,
      ...(fileToUpdate && { fileId: fileToUpdate }),
    })
    const initialResponse = await initialUploadRequest({
      resourceServerUrl,
      apiKey,
      tenantId,
      access,
      filePath,
      client,
      requestType,
      ...(fileToUpdate && { fileId: fileToUpdate }),
    });
    
    const { fileId } = initialResponse;
    const fileBuffer = await streamToBuffer(dataStream.data);
logger.info('beforeStream',{
      resourceServerUrl,
      apiKey,
      tenantId,
      fileId,
      fileBuffer,
      fileSize: fileBuffer.length,
      logger
    })
    await streamUploadRequests({
      resourceServerUrl,
      apiKey,
      tenantId,
      fileId,
      fileBuffer,
      fileSize: fileBuffer.length,
      logger
    });

    return fileId;
  } catch (er) {
    throw new Error(`Error occurred in the Filestore component: ${er.message}`);
  }
};

/**
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  const client = new FilestoreClient(this, cfg);
  const {
    requestType,
    customHeaders,
    requestBody,
    url,
    useConnectStorage,
    access,
    filePath,
    fileToUpdate
  } = msg?.body;
  const { apiKey, tenantId, resourceServerUrl } = cfg;
  const requestTypeTransformed = requestType?.toUpperCase();
  this.logger.info('msg raw', msg);

  if (typeof apiKey !== "string") {
    throw new Error(
      `Error occurred in the Filestore component - cfg.apiKey is required and needs to be a string, the ${apiKey} was received`
    );
  }

  if (typeof tenantId !== "string") {
    throw new Error(
      `Error occurred in the Filestore component - cfg.tenantId is required and needs to be a string, the ${tenantId} was received`
    );
  }

  if (typeof resourceServerUrl !== "string") {
    throw new Error(
      `Error occurred in the Filestore component - cfg.resourceServerUrl is required and needs to be a string, the ${resourceServerUrl} was received`
    );
  }

  if (!requestType) {
    throw new Error(
      `msg.body.requestType is required, the ${requestType} was received in the filestore Component`
    );
  }

  if (!["POST", "PATCH"].includes(requestTypeTransformed) && typeof url !== "string") {
    throw new Error(
      `msg.body.url is required and needs to be a string, the ${url} was received in the filestore Component`
    );
  }

  
  try {
    if (useConnectStorage && (requestTypeTransformed === "POST" || requestTypeTransformed === "PATCH")) {
      this.logger.info('Using storage for file upload/update');
      const fileId = await sendDataThroughStorage({
        apiKey,
        tenantId,
        resourceServerUrl,
        access,
        filePath,
        requestType: requestTypeTransformed,
        client,
        fileToUpdate,
        msg,
        logger: this.logger
      });

      await this.emit(
        "data",
        messages.newMessageWithBody({
          message: `Successfully processed file ${fileId}`,
          fileId
        })
      );
    } else {
      this.logger.info('Making direct API request',`${resourceServerUrl}/${url}`);
      this.logger.info('resourceServerUrl',resourceServerUrl);
      this.logger.info('url',url)
      const result = await client.makeRequest({
        url: `${resourceServerUrl}/${url}`,
        method: requestTypeTransformed,
        headers: {
          "x-api-key": apiKey,
          "x-dxp-tenant": tenantId,
          ...(customHeaders && customHeaders),
        },
        body: requestBody || undefined
      });

      await this.emit("data", messages.newMessageWithBody(result));
    }
  } catch (er) {
    this.logger.error(
      `Error occurred in the Filestore component: ${er.message}`
    );
    this.emit("end");
    throw new Error(
      `Error occurred in the Filestore component: ${er.message}`
    );
  }
};
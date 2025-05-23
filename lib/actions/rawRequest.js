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
  streamToBuffer
} = require("../util");

const sendDataThroughStorage = async function ({
  apiKey,
  tenantId,
  resourceServerUrl,
  access,
  filePath,
  requestType,
  fileToUpdate,
  client,
  msg,
  customHeaders,
  logger,
}) {
  const attachmentName = Object.keys(msg.attachments)[0];
  const attachmentProcessor = new AttachmentProcessor(getUserAgent(), msg.id);
  let dataStream;

  try {
    dataStream = await attachmentProcessor.getAttachment(
      msg.attachments[attachmentName].url,
      "stream"
    );

    const initialResponse = await initialUploadRequest({
      resourceServerUrl,
      apiKey,
      tenantId,
      access,
      filePath,
      client,
      requestType,
      customHeaders,
      ...(fileToUpdate && { fileId: fileToUpdate }),
    });

    const { fileId } = initialResponse;
    const fileBuffer = await streamToBuffer(dataStream.data);

    await streamUploadRequests({
      resourceServerUrl,
      apiKey,
      tenantId,
      fileId,
      fileBuffer,
      fileSize: fileBuffer.length,
      logger,
      customHeaders,
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
    fileToUpdate,
  } = msg?.body;
  const { apiKey, tenantId, resourceServerUrl } = cfg;
  const requestTypeTransformed = requestType?.toUpperCase();

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

  if (
    !["POST", "PATCH"].includes(requestTypeTransformed) &&
    typeof url !== "string"
  ) {
    throw new Error(
      `msg.body.url is required and needs to be a string, the ${url} was received in the filestore Component`
    );
  }

  try {
    if (
      useConnectStorage &&
      (requestTypeTransformed === "POST" || requestTypeTransformed === "PATCH")
    ) {
      this.logger.info("Using storage for file upload/update");
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
        customHeaders,
        logger: this.logger,
      });

      await this.emit(
        "data",
        messages.newMessageWithBody({
          message: `Successfully processed file ${fileId}`,
          fileId,
        })
      );
    } else {
      this.logger.info(
        "Making direct API request to:",
        `${resourceServerUrl}/${url}`
      );
      const result = await axios({
        method: requestTypeTransformed,
        url: `${resourceServerUrl}/${url}`,
        headers: {
          "x-api-key": apiKey,
          "x-dxp-tenant": tenantId,
          ...(customHeaders && customHeaders),
        },
        data: requestBody || undefined,
      });

      await this.emit("data", messages.newMessageWithBody(result.data));
    }
  } catch (er) {
    this.logger.error(
      `Error occurred in the Filestore component: ${er.message}`
    );
    this.emit("end");
    throw new Error(`Error occurred in the Filestore component: ${er.message}`);
  }
};

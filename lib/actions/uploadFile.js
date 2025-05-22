const { messages } = require("elasticio-node");
const FilestoreClient = require("../filestoreClient");
const axios = require("axios");
const {
  AttachmentProcessor,
} = require("@elastic.io/component-commons-library");
const { getUserAgent, initialUploadRequest, streamUploadRequests, streamToBuffer } = require("../util");

/**
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  const { access, filePath } = msg?.body;
  const { apiKey, tenantId, resourceServerUrl } = cfg;
  this.logger.info("msg", msg);

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

  if (typeof filePath !== "string") {
    throw new Error(
      `msg.body.filePath is required and needs to be a string, the ${filePath} was received in the filestore Component`
    );
  }

  if (!["private", "public"].includes(access)) {
    throw new Error(
      `Error occured in the Filestore component - msg.body.access is required and needs to be one of "private", "public"], the ${access} was received`
    );
  }

  try {
    const client = new FilestoreClient(this, cfg);
    const attachmentName = Object.keys(msg.attachments)[0];
    const attachmentProcessor = new AttachmentProcessor(getUserAgent(), msg.id);
    const dataStream = await attachmentProcessor.getAttachment(
      msg.attachments[attachmentName].url,
      "stream"
    );

    const initialResponse = await initialUploadRequest({
      client,
      resourceServerUrl,
      apiKey,
      tenantId,
      access,
      filePath,
      fileId
    });
    const { fileId } = initialResponse;
    const fileBuffer = await streamToBuffer(dataStream.data);

    await streamUploadRequests({
      resourceServerUrl,
      apiKey,
      tenantId,
      fileId,
      fileBuffer: fileBuffer,
      fileSize: fileBuffer.length,
      logger: this.logger,
    });

    await this.emit(
      "data",
      messages.newMessageWithBody({
        message: `successfully uploaded file ${fileId}`,
      })
    );
  } catch (er) {
    this.logger.error(
      `Error occurred in the Filestore component: ${er.message}`
    );
    this.emit("end");
    throw new Error(`Error occured in the Filestore component: ${er.message}`);
  }
};

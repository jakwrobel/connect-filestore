const { messages } = require('elasticio-node');
const FilestoreClient = require('../filestoreClient');
import * as commons from '@elastic.io/component-commons-library';

export const getUserAgent = () => {
    const { name: compName } = packageJson;
    const { version: compVersion } = compJson;
    const maesterClientVersion = packageJson.dependencies['@elastic.io/maester-client'];
    return `${compName}/${compVersion} maester-client/${maesterClientVersion}`;
  };

export const getFileStream = async (url, logger) => commons.axiosReqWithRetryOnServerError.call({ logger, cfg: {} }, {
    method: 'GET',
    url,
    responseType: 'stream'
  });

  export const getAttachmentStream = async (url, msgId, logger) => {
    const attachmentProcessor = new commons.AttachmentProcessor(getUserAgent(), msgId);
    let response;
    try {
      if (isMaesterUrl(url)) {
        response = await attachmentProcessor.getAttachment(url, 'stream');
      } else {
        response = await getFileStream(url, logger);
      }
      return response;
    } catch (err) {
      throw new Error(`Can't extract file from provided url: ${url}, error: ${err.message}`);
    }
  };

/**
 * Executes the action's logic by sending a request to the
 * Filestore API and emitting response to the platform.
 * The function emits the results of the request to the platform as a message
 *
 * @param msg incoming messages which is empty for triggers
 * @param cfg object to retrieve configuration values, such as apiKey and dxp tenant id
 */
exports.process = async function process(msg, cfg) {
  // create a client object that has methods to make a request available to us
  const client = new FilestoreClient(this, cfg);
  const { fileId } = msg.body;

  if (!fileId) {
    throw new Error('Name is required');
  }

  const result = await client.makeRequest({
    url: `api/v2/file/${fileId}/download`,
    method: 'GET',
    headers:{
      "x-api-key": cfg.apiKey,
      "x-dxp-tenant": cfg.tenantId
    }
  });

  // this.emit is a function provided by sailor - we use it to emit messages to
  // our platform
  await this.emit('data', messages.newMessageWithBody(result));
};

const { messages } = require('elasticio-node');
const FilestoreClient = require('../filestoreClient');
import { writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import * as commons from '@elastic.io/component-commons-library';
import packageJson from '../package.json';
import compJson from '../component.json';

export const getUserAgent = () => {
  const { name: compName } = packageJson;
  const { version: compVersion } = compJson;
  const maesterClientVersion = packageJson.dependencies['@elastic.io/maester-client'];
  return `${compName}/${compVersion} maester-client/${maesterClientVersion}`;
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
  this.logger.info(JSON.stringify(msg))
  this.logger.info(JSON.stringify(cfg))
  const client = new FilestoreClient(this, cfg);
  const { data, access, source, uploadType } = msg?.body

  if (!data) {
    throw new Error(`msg.body.data is required, the ${data} was received in the filestore Component`);
  }

  if (typeof source !== "string") {
    throw new Error(`msg.body.source is required and needs to be a string, the ${source} was received in the filestore Component`);
  }

  if (typeof access !== "string") {
    throw new Error(`msg.body.access is required and needs to be a string, the ${access} was received in the filestore Component`);
  }

  if (typeof uploadType !== "string") {
    throw new Error(`msg.body.uploadType is required and needs to be a string, the ${uploadType} was received in the filestore Component`);
  }

  const TMP_DATA_PATH = '/tmp/data';
  const accessToSet = access ? access : "public"

  //Data to post in base64 format
  const base64Data= Buffer.from(data).toString('base64')
  this.logger.info(JSON.stringify(access))
  this.logger.info(JSON.stringify(data))
  this.logger.info(JSON.stringify(base64Data))
  this.logger.info(JSON.stringify(source))
  const result = await client.makeRequest({
    url: `${cfg.resourceServerUrl}/api/v2/file`,
    method: 'POST',
    headers:{
      "x-api-key": cfg.apiKey,
      "x-dxp-tenant": cfg.tenantId
    },
    body:{
      "access":accessToSet,
      "data": base64Data,
      "source": source,
      "uploadType": uploadType
    }
  });

    this.logger.info('Got new file, start uploading to internal storage');
    await writeFile(TMP_DATA_PATH, data);
    const attachmentProcessor = new commons.AttachmentProcessor(getUserAgent(), msg.id);
    const getAttachment = async () => createReadStream(TMP_DATA_PATH);
    const attachmentId = await attachmentProcessor.uploadAttachment(getAttachment);
    const attachmentUrl = attachmentProcessor.getMaesterAttachmentUrlById(attachmentId);
    result.attachmentUrl = attachmentUrl;

  this.logger.info('Request is done, emitting...');
  return messages.newMessageWithBody(result);

  // await this.emit('data', messages.newMessageWithBody(result));
};

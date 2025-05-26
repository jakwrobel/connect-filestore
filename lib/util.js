const packageJson = require("../package.json");
const compJson = require("../component.json");
const axios = require("axios");

function getUserAgent() {
  const { name: compName } = packageJson;
  const { version: compVersion } = compJson;
  const libVersion =
    packageJson.dependencies["@elastic.io/component-commons-library"];
  return `${compName}/${compVersion} component-commons-library/${libVersion}`;
}

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

async function initialUploadRequest({
  client,
  apiKey,
  tenantId,
  resourceServerUrl,
  access,
  filePath,
  fileId,
  customHeaders,
}) {
  const fileEndpoint = fileId
    ? `${resourceServerUrl}/api/v2/file/${fileId}`
    : `${resourceServerUrl}/api/v2/file`;
  try {
    const response = await client.makeRequest({
      url: fileEndpoint,
      method: fileId ? "PATCH" : "POST",
      headers: {
        "x-api-key": apiKey,
        "x-dxp-tenant": tenantId,
        "content-type": "application/json",
        ...(customHeaders && customHeaders),
      },
      body: {
        access: access,
        source: filePath,
        uploadType: "resumable",
      },
    });
    return response;
  } catch (error) {
    logger.error(
      `Failed to send request to ${fileEndpoint}. Error: ${error.message}`
    );
    throw new Error(
      `Failed to send request to ${fileEndpoint}. Error: ${error.message}`
    );
  }
}

async function streamUploadRequests({
  apiKey,
  tenantId,
  resourceServerUrl,
  fileId,
  fileBuffer,
  fileSize,
  logger,
  customHeaders,
}) {
  // Set the chunk size to 10MB/ Minimum required on server is 5MB, max is 50MB
  const chunkSize = 10 * 1024 * 1024;
  const numberOfChunks = Math.ceil(fileSize / chunkSize);

  for (let i = 0; i < numberOfChunks; i++) {
    const chunkStart = i * chunkSize;
    const chunkEnd = Math.min(chunkStart + chunkSize, fileSize);
    const chunk = fileBuffer.subarray(chunkStart, chunkEnd);

    // Temporarily axios is used, because elasticIO makeRequest works strange with the Patch requests
    // It adds a quotation mark before ont the beging of the data and deletes last character
    try {
      await axios.patch(`${resourceServerUrl}/api/v2/file/${fileId}`, chunk, {
        headers: {
          "x-api-key": apiKey,
          "x-dxp-tenant": tenantId,
          "content-type": "application/octet-stream",
          "content-range": `bytes ${chunkStart}-${chunkEnd - 1}/${fileSize}`,
          "content-length": `${chunk.length}`,
          ...(customHeaders && customHeaders),
        },
      });
    } catch (error) {
      logger.error(
        `Failed to upload chunk ${i + 1}/${numberOfChunks}. Error: ${
          error.message
        }`
      );
      throw new Error(
        `Failed to upload chunk ${i + 1}/${numberOfChunks}: ${error.message}`
      );
    }
  }
}

module.exports.getUserAgent = getUserAgent;
module.exports.initialUploadRequest = initialUploadRequest;
module.exports.streamUploadRequests = streamUploadRequests;
module.exports.streamToBuffer = streamToBuffer;

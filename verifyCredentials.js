const FilestoreClient = require("./lib/filestoreClient");

/**
 * Executes the verification logic by sending a simple request to the server
 * If the request succeeds or returns response with 400 code we can assume that the apiKey is valid. Otherwise it is not valid.
 * Response with code 400 is considered to be okay, because all filestore endpoints require additional parameters like e.g. fileId
 * which can not be provided during credentials verification, as they are not credentials.
 * If the credentials are not valid, filestore server will return 401 or 403 response.
 *
 * @param credentials object to retrieve apiKey from
 *
 * @returns boolean of whether or not the request was successful
 */
module.exports = async function verify(credentials) {
  this.logger.info("verify called")
  const { apiKey, tenantId, resourceServerUrl } = credentials;

  if (!apiKey) throw new Error("API key is missing");
  if (!tenantId) throw new Error("Tenant ID is missing");
  if (!resourceServerUrl) throw new Error("Resource server URL is missing");
  const client = new FilestoreClient(this, credentials);
  this.logger.info("The credentials: ", apiKey, tenantId, resourceServerUrl)
    console.log("The credentials: ", apiKey, tenantId, resourceServerUrl)

  try {
    this.logger.info("The credentials: ", apiKey, tenantId, resourceServerUrl)
    console.log("The credentials: ", apiKey, tenantId, resourceServerUrl)
    const result = await client.makeRequest({
      url: `${resourceServerUrl}/api/v2/file/`,
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "x-dxp-tenant": tenantId,
      },
    });
    this.logger.info('request succeeded')
    return true;
  } catch (e) {
    this.logger.info('catch block')
    this.logger.info('response', e.response)
    this.logger.info('status', e.response.status)
    if (e.response) {
      this.logger.info('e.response block')
      const status = e.response.status;
      if (status === 400) {
        this.logger.info('status 400 block')
        return true;
      }
    }
    this.logger.info('other codes error block')
    // Other cases (no response, status other than 2xx or 400)
    throw new Error("Verification failed")
  }
};

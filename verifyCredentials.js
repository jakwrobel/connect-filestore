const axios = require("axios");

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
  this.logger.info("Starting verification...");
  const { apiKey, tenantId, resourceServerUrl } = credentials;

  if (!apiKey) throw new Error("Verification failed. API key is missing");
  if (!tenantId) throw new Error("Verification failed. Tenant ID is missing");
  if (!resourceServerUrl) throw new Error("Verification failed. Resource server URL is missing");

  try {
     await axios.get(`${resourceServerUrl}/api/v2/file/`, {
      headers: {
        "x-api-key": apiKey,
        "x-dxp-tenant": tenantId,
      },
    });

    this.logger.info("Verification succeeded");
    return true;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 400 || (status >= 200 && status < 300)) {
      this.logger.info("Verification succeeded");
      return true;
    }
    if (status >= 500) {
      this.loger.info("Verify function failed",e?.response?.data?.message);
      throw new Error("Inrernal server error. Please try again later.");
    }
    this.loger.error("Failed",e);
    this.loger.error("Verify failed",e?.response?.data?.message);
    throw new Error("Verification failed");
  }
};

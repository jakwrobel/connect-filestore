// const MagentoClient = require('./lib/petstoreClient');

/**
 * Executes the verification logic by sending a simple to the
 * Petstore API using the provided apiKey.
 * If the request succeeds, we can assume that the apiKey is valid. Otherwise it is not valid.
 *
 * @param credentials object to retrieve apiKey from
 *
 * @returns boolean of whether or not the request was successful
 */
module.exports = async function verify(credentials) {
  const { apiKey, tenantId, resourceServerUrl } = credentials;

  if (!apiKey) throw new Error("API key is missing");
  if (!tenantId) throw new Error("Tenant ID is missing");
  if (!resourceServerUrl) throw new Error("Resource server URL is missing");

  // const client = new MagentoClient(this, credentials);

  try {
    console.log("The credentials: ", apiKey, tenantId, resourceServerUrl)
    const result = await client.makeRequest({
      url: `${resourceServerUrl}/api/v2/file/`,
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "x-dxp-tenant": tenantId,
      },
    });
    return true;
  } catch (e) {
    console.log(e)
    console.log(e.response)
    if (e.response) {
      const status = e.response.status;
      if (status === 400) {
        return true;
      }
    }

    // Other cases (no response, status other than 2xx or 400)
    return false;
  }
};

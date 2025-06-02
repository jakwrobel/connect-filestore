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
  this.logger.info("verify")
  const client = new FilestoreClient(this, credentials);
  const { apiKey } = credentials;

  if (!apiKey) throw new Error('API key is missing');

  try {
    // sending a request to the most simple endpoint of the target API
    await client.makeRequest({
      url: '/user/me',
      method: 'GET',
    });

    // if the request succeeds, we can assume the api key is valid
    this.logger.info("this is valid!")
    return true;
  } catch (e) {
    this.logger.info("this is invalid!")
    return false;
  }
};
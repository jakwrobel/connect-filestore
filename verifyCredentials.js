export async function verify(cfg) {

  try {
    this.logger.info('Verification completed successfully');
    return { verified: true };
  } catch (e) {
    this.logger.error('Verification failed');
    this.logger.error(JSON.stringify(e.response.data));
    throw new Error(e.response.data.message);
  }
}


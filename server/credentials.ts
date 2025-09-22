// Helper to get Vimeo API credentials from environment variables
export async function getVimeoCredentials() {
  const accessToken = process.env.VIMEO_ACCESS_TOKEN;
  const clientId = process.env.VIMEO_CLIENT_ID;
  const clientSecret = process.env.VIMEO_CLIENT_SECRET;

  if (!accessToken || !clientId || !clientSecret) {
    throw new Error('Missing required Vimeo API credentials. Please check your environment variables.');
  }

  return {
    accessToken,
    clientId,
    clientSecret
  };
}
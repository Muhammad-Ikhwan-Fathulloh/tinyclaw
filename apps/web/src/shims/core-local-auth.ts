/** Browser shim — local auth tokens live on disk in CLI/server, not in the web app. */
export async function loadLocalAuthToken(): Promise<string | null> {
  return null;
}

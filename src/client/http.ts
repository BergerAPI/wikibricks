// Pages and their endpoints live under the language of the document, like /en/entities/search
export const localUrl = (path: string) => `/${document.documentElement.lang}${path === "/" ? "" : path}`;

/**
 * Sends a request to a path of the site and fails with the server's message unless it succeeds.
 */
export async function request(url: string, options: RequestInit): Promise<Response> {
  const response = await fetch(localUrl(url), options);
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
  return response;
}

export const sendJson = (url: string, body: unknown, method = "POST") =>
  request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

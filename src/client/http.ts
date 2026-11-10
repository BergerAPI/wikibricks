export async function request(
  url: string,
  options: RequestInit,
): Promise<Response> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(
      (await response.text()) || `Request failed (${response.status})`,
    );
  }
  return response;
}

export const sendJson = (url: string, body: unknown, method = "POST") =>
  request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

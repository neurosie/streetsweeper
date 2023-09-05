export function fetchWithUA(
  input: RequestInfo | URL,
  { headers, ...options }: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    headers: {
      "User-Agent": `StreetSweeper (${process.env.OWNER_EMAIL})`,
      ...headers,
    },
    ...options,
  });
}

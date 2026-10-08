export type HttpRequest = { method: "GET" | "POST"; url: string; headers: Record<string, string>; body?: string };
export type HttpResponse = { status: number; text: string };
/** The only place that talks to the network. Tests inject a fake. Bodies and headers are never logged. */
export type Transport = (r: HttpRequest) => Promise<HttpResponse>;

export const fetchTransport: Transport = async (r) => {
  const res = await fetch(r.url, { method: r.method, headers: r.headers, body: r.body, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  return { status: res.status, text: await res.text() };
};

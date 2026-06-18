import type { NativeHttpPlugin, HttpRequestOptions, HttpResponse } from "./definitions";

export class NativeHttpWeb implements NativeHttpPlugin {
  async request(options: HttpRequestOptions): Promise<HttpResponse> {
    const res = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
    });

    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => { headers[key] = value; });

    return {
      status: res.status,
      statusText: res.statusText,
      headers,
      body: await res.text(),
    };
  }
}

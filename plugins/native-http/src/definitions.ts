export interface HttpRequestOptions {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: string;
  responseType?: "text" | "blob";
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}

export interface NativeHttpPlugin {
  request(options: HttpRequestOptions): Promise<HttpResponse>;
}

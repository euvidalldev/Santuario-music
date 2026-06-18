import { Capacitor } from "@capacitor/core";
import type { NativeHttpPlugin, HttpRequestOptions, HttpResponse } from "./definitions";
import { NativeHttpWeb } from "./web";

// Try to use the native Capacitor plugin, fall back to web implementation
let instance: NativeHttpPlugin;

async function getInstance(): Promise<NativeHttpPlugin> {
  if (instance) return instance;
  if (Capacitor.isNativePlatform()) {
    // The native plugin should be registered on the Java side.
    // We use a dynamic import here to avoid TS issues.
    const cap = await import("@capacitor/core");
    const p = cap.registerPlugin<NativeHttpPlugin>("NativeHttp");
    instance = p;
  } else {
    instance = new NativeHttpWeb();
  }
  return instance;
}

// Convenience wrapper that matches the pattern used by inner-tube.ts
export const NativeHttp = {
  async request(options: HttpRequestOptions): Promise<HttpResponse> {
    const inst = await getInstance();
    return inst.request(options);
  },
};

export type { NativeHttpPlugin, HttpRequestOptions, HttpResponse };

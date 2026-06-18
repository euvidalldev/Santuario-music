import { Capacitor, CapacitorHttp } from "@capacitor/core";

const INNERTUBE_API = "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

const CLIENTS = {
  android_vr: {
    clientName: "ANDROID_VR",
    clientVersion: "1.66",
    androidSdkVersion: 34,
  },
  android: {
    clientName: "ANDROID",
    clientVersion: "19.45.36",
    androidSdkVersion: 34,
  },
  ios: {
    clientName: "IOS",
    clientVersion: "19.45.36",
    deviceModel: "iPhone16,2",
    osVersion: "18.4.0",
  },
  tv: {
    clientName: "TVHTML5_SIMPLY",
    clientVersion: "1.0",
  },
} as const;

type ClientName = keyof typeof CLIENTS;

export interface TrackInfo {
  title: string;
  artist: string;
  duration: number;
  thumbnailUrl: string | null;
  videoId: string;
}

export interface AudioFormat {
  url: string;
  mimeType: string;
  bitrate: number;
  contentLength: number;
  audioChannels: number;
}

const UA_IOS = "com.google.ios.youtube/19.45.36 (iPhone16,2; U; CPU iOS 18_4_0 like Mac OS X)";
const UA_ANDROID = "com.google.android.youtube/19.45.36 (Linux; U; Android 14) gzip";

async function nativeFetch(url: string, options: RequestInit): Promise<Response> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({
      url,
      method: (options.method as any) || "GET",
      headers: (options.headers as Record<string, string>) || {},
      data: typeof options.body === "string" ? options.body : undefined,
      responseType: "text",
    });
    return new Response(res.data, {
      status: res.status,
      headers: new Headers(res.headers || {}),
    });
  }
  return fetch(url, options);
}

export async function getTrackInfo(
  videoId: string,
  client: ClientName = "ios",
): Promise<{ info: TrackInfo; formats: AudioFormat[] }> {
  const clientInfo = CLIENTS[client];
  const body = {
    videoId,
    context: {
      client: clientInfo,
    },
  };

  const ua = client === "ios" ? UA_IOS : UA_ANDROID;

  const res = await nativeFetch(INNERTUBE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ua,
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Origin": "https://www.youtube.com",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube API returned ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`YouTube error: ${data.error.message || JSON.stringify(data.error)}`);
  }

  const videoDetails = data.videoDetails;
  if (!videoDetails) {
    throw new Error("No video details in response");
  }

  const info: TrackInfo = {
    title: videoDetails.title || "Unknown Title",
    artist: videoDetails.author || videoDetails.channelOwner || "Unknown Artist",
    duration: parseInt(videoDetails.lengthSeconds || "0", 10),
    thumbnailUrl: videoDetails.thumbnail?.thumbnails?.[videoDetails.thumbnail.thumbnails.length - 1]?.url || null,
    videoId,
  };

  const formats: AudioFormat[] = [];
  const streamingData = data.streamingData;
  if (streamingData) {
    const allFormats = [
      ...(streamingData.formats || []),
      ...(streamingData.adaptiveFormats || []),
    ];

    for (const f of allFormats) {
      const mime = f.mimeType || "";
      if (mime.startsWith("audio/")) {
        const url = f.url || f.signatureCipher || "";
        if (!url || url.startsWith("http")) {
          formats.push({
            url: url || "",
            mimeType: mime.split(";")[0],
            bitrate: f.bitrate || 0,
            contentLength: parseInt(f.contentLength || "0", 10),
            audioChannels: f.audioChannels || 2,
          });
        }
      }
    }
  }

  if (formats.length === 0) {
    throw new Error("No audio formats found. The video might be restricted.");
  }

  formats.sort((a, b) => b.bitrate - a.bitrate);

  return { info, formats };
}

export async function downloadAudio(url: string): Promise<ArrayBuffer> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({
      url,
      method: "GET",
      headers: {
        "Referer": "https://www.youtube.com",
        "User-Agent": UA_IOS,
      },
      responseType: "blob",
    });
    const binary = atob(res.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Referer": "https://www.youtube.com",
      "User-Agent": UA_IOS,
    },
  });

  if (!res.ok) {
    throw new Error(`Audio download returned ${res.status}`);
  }

  return res.arrayBuffer();
}

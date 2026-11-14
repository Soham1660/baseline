export async function computeFileSha256(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface VideoProbeInfo {
  durationSeconds: number;
  width: number;
  height: number;
}

export function probeVideoFile(url: string): Promise<VideoProbeInfo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timed out reading video metadata.'));
    }, 10000);

    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      cleanup();
      resolve({ durationSeconds: duration, width, height });
    };

    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('Could not decode this video format in browser.'));
    };

    video.src = url;
  });
}

export async function extractVideoThumbnails(
  videoUrl: string,
  timestamps: number[],
  targetWidth = 320,
  targetHeight = 180
): Promise<Map<number, string>> {
  const uniqueTimes = Array.from(new Set(timestamps.map((t) => Math.max(0, Math.round(t * 10) / 10))));
  const results = new Map<number, string>();
  if (!videoUrl || uniqueTimes.length === 0) return results;

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(overallTimeout);
      video.removeAttribute('src');
      video.load();
      resolve(results);
    };

    const overallTimeout = window.setTimeout(finish, 18000);

    video.onerror = () => finish();

    video.onloadeddata = async () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 16;

      for (const rawTime of uniqueTimes) {
        if (finished) break;
        const clamped = Math.min(Math.max(0.05, rawTime), Math.max(0.05, duration - 0.08));
        try {
          await seekVideoTo(video, clamped);
          if (ctx) {
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            results.set(rawTime, dataUrl);
          }
        } catch {
          // Skip individual frame failure without aborting remaining captures
        }
      }
      finish();
    };

    video.src = videoUrl;
  });
}

function seekVideoTo(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      reject(new Error('Seek timeout'));
    }, 2500);

    const onSeeked = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };

    video.addEventListener('seeked', onSeeked);
    video.currentTime = targetTime;
  });
}

export function captureCurrentVideoFrame(
  video: HTMLVideoElement,
  targetWidth = 320,
  targetHeight = 180
): string | undefined {
  try {
    if (!video || video.readyState < 2) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return undefined;
  }
}

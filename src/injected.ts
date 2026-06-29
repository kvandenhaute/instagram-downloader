// Draait in de pagina-context (MAIN world)

const sourceBufferToMediaSource = new WeakMap<SourceBuffer, MediaSource>();
const mediaSourceToBlobUrl = new WeakMap<MediaSource, string>();

// Patch fetch — tag de originele ArrayBuffer met de chunk URL
const originalFetch = window.fetch.bind(window);
window.fetch = async function (...args: Parameters<typeof fetch>) {
  const response = await originalFetch(...args);
  const url = args[0] instanceof Request ? args[0].url : String(args[0]);

  if (url.includes('.mp4')) {
    const originalArrayBuffer = response.arrayBuffer.bind(response);
    response.arrayBuffer = async function () {
      const buffer = await originalArrayBuffer();
      (buffer as unknown as Record<string, string>).__igDlUrl = url;
      return buffer;
    };
  }

  return response;
};

// Patch XHR
const originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
  const urlStr = String(url);
  if (urlStr.includes('.mp4')) {
    this.addEventListener('load', () => {
      if (this.response instanceof ArrayBuffer) {
        (this.response as unknown as Record<string, string>).__igDlUrl = urlStr;
      }
    });
  }
  return (originalOpen as Function).call(this, method, url, ...rest);
};

// Patch MediaSource.addSourceBuffer
const originalAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
MediaSource.prototype.addSourceBuffer = function (mimeType: string) {
  const sb = originalAddSourceBuffer.call(this, mimeType);
  sourceBufferToMediaSource.set(sb, this);
  return sb;
};

// Patch URL.createObjectURL
const originalCreateObjectURL = URL.createObjectURL.bind(URL);
URL.createObjectURL = function (source: Blob | MediaSource | MediaStream) {
  const blobUrl = originalCreateObjectURL(source as Blob);
  if (source instanceof MediaSource) {
    mediaSourceToBlobUrl.set(source, blobUrl);
  }
  return blobUrl;
};

// Patch SourceBuffer.appendBuffer — hier kennen we de volledige keten
const originalAppendBuffer = SourceBuffer.prototype.appendBuffer;
SourceBuffer.prototype.appendBuffer = function (data: BufferSource) {
  const buffer = data instanceof ArrayBuffer ? data : (data as ArrayBufferView).buffer;
  const chunkUrl = (buffer as unknown as Record<string, string>).__igDlUrl;
  const mediaSource = sourceBufferToMediaSource.get(this);
  const blobUrl = mediaSource ? mediaSourceToBlobUrl.get(mediaSource) : undefined;

  if (chunkUrl && blobUrl) {
    window.dispatchEvent(new CustomEvent('ig-dl-chunk', {
      detail: { blobUrl, chunkUrl },
    }));
  }

  return originalAppendBuffer.call(this, data);
};

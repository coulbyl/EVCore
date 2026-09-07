export type UploadUrlRequest = {
  objectKey: string;
  contentType: string;
  contentLength: number;
};

export type DownloadUrlRequest = {
  objectKey: string;
  // "attachment" forces a browser download instead of rendering the
  // response body inline — the only thing standing between an attacker
  // uploading a file whose declared Content-Type an S3-compatible store
  // will happily echo back, and that content rendering as HTML/SVG in the
  // recipient's browser (stored XSS on the storage origin). IMAGE/AUDIO
  // need "inline" so <img>/<audio> keep working.
  disposition: 'inline' | 'attachment';
  fileName?: string | null;
};

export type HeadObjectResult = {
  exists: boolean;
  contentLength: number | null;
  contentType: string | null;
};

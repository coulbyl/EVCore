export type UploadUrlRequest = {
  objectKey: string;
  contentType: string;
  contentLength: number;
};

export type HeadObjectResult = {
  exists: boolean;
  contentLength: number | null;
  contentType: string | null;
};

import { renderShareImage, shareImageAlt } from "./_og/share-image";

export const alt = shareImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderShareImage();
}

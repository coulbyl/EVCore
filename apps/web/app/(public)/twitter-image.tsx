import { renderShareImage, shareImageAlt } from "./_og/share-image";

export const alt = shareImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The hero of the day (11 § 1): read on each request, cached by D8.
export default function Image() {
  return renderShareImage();
}

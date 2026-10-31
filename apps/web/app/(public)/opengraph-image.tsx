import { renderShareImage, shareImageAlt } from "./_og/share-image";

export const alt = shareImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The hero of the day (11 § 1): served static, rebuilt at most once a
// minute with its data (PUBLIC_TODAY_REVALIDATE_S). 16 § 3 said a day, but
// a day-old image would show yesterday's hero, or a match not yet settled.
export const revalidate = 60;

export default function Image() {
  return renderShareImage();
}

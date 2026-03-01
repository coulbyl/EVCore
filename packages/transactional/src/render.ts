import { render } from "@react-email/render";
import { type ReactElement } from "react";
import { type RenderedEmail } from "./types";

export async function renderEmail(
  element: ReactElement,
): Promise<RenderedEmail> {
  const html = await render(element);
  const text = await render(element, { plainText: true });
  return { html, text };
}

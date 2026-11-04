"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ComponentProps } from "react";
import { isPlainClick } from "./sheet-constants";
import { isSheetOpen } from "./sheet-relay";

/**
 * Opens a sheet from code: one sheet at a time, on screen and in the
 * history. With a sheet already open (a coupon of a product's detail, a
 * match of the list beside it on a wide screen), the next one replaces it
 * instead of stacking: closing it (cross, Escape, scrim, gesture or the
 * browser's back) leads to the screen under the sheet, not to the one
 * before — five matches opened in a row asked for five closings.
 *
 * Without a sheet open, an ordinary navigation, intercepted by the `@sheet`
 * slot. The sheet already open: nothing to add to the history.
 */
export function useOpenSheet(): (href: string) => void {
  const router = useRouter();
  return useCallback(
    (href: string) => {
      if (!isSheetOpen()) {
        router.push(href);
        return;
      }
      const { pathname, search, hash } = window.location;
      if (href === `${pathname}${search}${hash}`) return;
      router.replace(href, { scroll: false });
    },
    [router],
  );
}

/**
 * A link to a sheet (`@sheet/(.)…`): a coupon, a match, a product's detail,
 * the ticket. It goes through `useOpenSheet`, so a sheet opened from a
 * sheet replaces it. Every link whose target opens in a sheet uses it; a
 * plain `next/link` to a sheet stacks — on purpose for the « ? » of a
 * product's sheet (`HelpHint`): closing the help leads back to that sheet
 * (09 § 3). A modified click (new tab) passes as is.
 */
export function SheetLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const open = useOpenSheet();
  return (
    <Link
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !isPlainClick(event)) return;
        // No sheet open: the link's own navigation, prefetched.
        if (!isSheetOpen()) return;
        event.preventDefault();
        open(href);
      }}
    />
  );
}

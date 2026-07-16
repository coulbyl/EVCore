"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@evcore/ui";
import { useIsMobile } from "@/hooks/use-mobile";

// Dialog on desktop, bottom Drawer on mobile — same open/onOpenChange contract
// as the underlying primitives, so call sites don't need to branch.
export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Drawer : Dialog;
  return (
    <Root open={open} onOpenChange={onOpenChange}>
      {children}
    </Root>
  );
}

export function ResponsiveDialogContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const Content = isMobile ? DrawerContent : DialogContent;
  return <Content className={className}>{children}</Content>;
}

export function ResponsiveDialogHeader({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const Header = isMobile ? DrawerHeader : DialogHeader;
  return <Header>{children}</Header>;
}

export function ResponsiveDialogTitle({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const Title = isMobile ? DrawerTitle : DialogTitle;
  return <Title>{children}</Title>;
}

export function ResponsiveDialogDescription({
  children,
}: {
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const Description = isMobile ? DrawerDescription : DialogDescription;
  return <Description>{children}</Description>;
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="scrollbar-dark h-dvh overflow-y-auto">{children}</div>;
}

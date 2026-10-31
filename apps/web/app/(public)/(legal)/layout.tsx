import "../../globals.css";

/** The legal pages keep the application's stylesheet until D6. */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-dvh overflow-y-auto">{children}</div>;
}

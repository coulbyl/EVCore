import "../../globals.css";

/** Sign-in and sign-up keep the application's stylesheet until D4–D5. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-dvh overflow-y-auto">{children}</div>;
}

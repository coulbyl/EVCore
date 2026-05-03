import { FormationProgressSync } from "./components/formation-progress-sync";
import { FormationProgressProvider } from "@/domains/formation/use-cases/use-formation-progress";

export default function FormationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FormationProgressProvider>
      <FormationProgressSync />
      {children}
    </FormationProgressProvider>
  );
}

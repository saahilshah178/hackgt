import { AppShell } from "@/components/app-shell";
import { IntakeForm } from "@/components/flow/intake-form";

export default async function IntakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <IntakeForm sourceId={id} />
    </AppShell>
  );
}

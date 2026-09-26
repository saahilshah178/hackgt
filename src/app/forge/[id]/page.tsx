import { AppShell } from "@/components/app-shell";
import { ForgeBoard } from "@/components/flow/forge-board";

export default async function ForgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell wide>
      <ForgeBoard jobId={id} />
    </AppShell>
  );
}

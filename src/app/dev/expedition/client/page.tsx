import { notFound } from "next/navigation";
import { Loader } from "./Loader";

export const metadata = { title: "Dev expedition: client (dev)" };

/**
 * /dev/expedition/client (H2) — the dev world played end to end through ExpeditionClient (the phase machine, dialogue,
 * panel, express), unlike /dev/expedition, which mounts the bare host with a stand-in panel. Not served in production.
 */
export default function DevExpeditionClientPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Loader />;
}

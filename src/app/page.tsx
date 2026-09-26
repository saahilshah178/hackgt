import { APP_NAME, APP_TAGLINE } from "@/config";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-5xl font-bold tracking-tight">{APP_NAME}</h1>
      <p className="text-xl text-muted-foreground">{APP_TAGLINE}</p>
    </main>
  );
}

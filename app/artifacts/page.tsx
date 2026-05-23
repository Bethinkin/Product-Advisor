import { ArtifactsClient } from "@/components/artifacts/artifacts-client";

export default function ArtifactsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-1">Artifacts</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Upload meeting transcripts (.txt/.docx/.pdf/.vtt/.md) and CSV data. Or paste text directly.
          The advisor reads these via tools — it doesn&apos;t pre-load everything into context.
        </p>
        <ArtifactsClient />
      </div>
    </div>
  );
}

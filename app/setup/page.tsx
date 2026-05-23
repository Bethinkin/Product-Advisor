import { SetupClient } from "@/components/setup/setup-client";

export default function SetupPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-1">Setup</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Connect integrations and configure scope. Anthropic API key is read from{" "}
          <code>.env</code>; MCP server commands too. This page only manages Notion scope.
        </p>
        <SetupClient />
      </div>
    </div>
  );
}

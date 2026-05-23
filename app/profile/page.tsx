import { ProfileClient } from "@/components/profile/profile-client";

export default function ProfilePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-1">Product Profile</h1>
        <p className="text-sm text-muted-foreground mb-6">
          The advisor&apos;s persistent memory about your product. It will read this on every turn
          and update it (via the <code>update_product_profile</code> tool) when you reveal durable
          facts. The <em>Agent notes</em> field is written by the assistant; edit it sparingly.
        </p>
        <ProfileClient />
      </div>
    </div>
  );
}

import { ChatPane } from "@/components/chat/chat-pane";
import { ConversationsList } from "@/components/chat/conversations-list";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return (
    <div className="flex-1 flex min-h-0">
      <ConversationsList activeId={conversationId} />
      <ChatPane conversationId={conversationId} />
    </div>
  );
}

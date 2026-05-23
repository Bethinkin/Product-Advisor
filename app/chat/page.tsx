import { ChatPane } from "@/components/chat/chat-pane";
import { ConversationsList } from "@/components/chat/conversations-list";

export default function ChatPage() {
  return (
    <div className="flex-1 flex min-h-0">
      <ConversationsList />
      <ChatPane />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";

import { ChatWindow } from "@/components/ki/chat-window";

export const Route = createFileRoute("/ki-assistent/$threadId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  return <ChatWindow threadId={threadId} />;
}

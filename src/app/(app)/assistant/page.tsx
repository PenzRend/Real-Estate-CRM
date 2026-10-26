import type { Metadata } from "next";
import { AssistantChat } from "@/components/assistant/assistant-chat";
import { llmConfig } from "@/lib/ai/config";

export const metadata: Metadata = { title: "AI-asszisztens" };

export default function AssistantPage() {
  return <AssistantChat aiEnabled={llmConfig() != null} />;
}

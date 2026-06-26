// Client-Hooks rund um den GHASI-AI-Gesprächsverlauf.
// Lesen direkt über den Supabase-Browser-Client (öffentliche SELECT-Policy),
// Schreiben über die abgesicherten Server-Funktionen.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";

import { supabase } from "@/integrations/supabase/client";
import { erstelleThread, benenneThread, loescheThread } from "@/lib/chat.functions";

export interface ChatThread {
  id: string;
  titel: string;
  archiviert: boolean;
  created_at: string;
  updated_at: string;
}

export function useThreads() {
  return useQuery({
    queryKey: ["chat-threads"],
    queryFn: async (): Promise<ChatThread[]> => {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("archiviert", false)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ChatThread[];
    },
  });
}

export function useThreadMessages(threadId: string | undefined) {
  return useQuery({
    queryKey: ["chat-messages", threadId],
    enabled: !!threadId,
    queryFn: async (): Promise<UIMessage[]> => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, rolle, parts, inhalt")
        .eq("thread_id", threadId!)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => {
        const parts =
          Array.isArray(row.parts) && row.parts.length > 0
            ? (row.parts as UIMessage["parts"])
            : ([{ type: "text", text: row.inhalt ?? "" }] as UIMessage["parts"]);
        return {
          id: row.id,
          role: row.rolle === "user" ? "user" : "assistant",
          parts,
        } as UIMessage;
      });
    },
  });
}

export function useThreadMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["chat-threads"] });

  const create = useMutation({
    mutationFn: async (titel?: string) => erstelleThread({ data: { titel } }),
    onSuccess: invalidate,
  });
  const rename = useMutation({
    mutationFn: async (v: { id: string; titel: string }) => benenneThread({ data: v }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => loescheThread({ data: { id } }),
    onSuccess: invalidate,
  });

  return { create, rename, remove };
}

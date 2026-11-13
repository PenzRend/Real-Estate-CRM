"use client";

import { useEffect, useState } from "react";
import { unreadTotalAction } from "@/app/(app)/messages/actions";
import { createBrowserSupabase } from "@/lib/supabase/client";

/** Unread chat messages, for the menu badge: fetched on each page change and whenever a message arrives. */
export function useChatUnread(pathname: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let live = true;
    void unreadTotalAction()
      .then((n) => live && setCount(n))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pathname]);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      // A fresh name each time: the previous channel may still be closing, and
      // reusing its name returns that subscribed channel, which rejects `.on()`.
      .channel(`chat-unread-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => {
        // The open conversation marks its messages read first; count a moment later.
        clearTimeout(timer);
        timer = setTimeout(() => void unreadTotalAction().then(setCount).catch(() => {}), 800);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, []);

  return count;
}

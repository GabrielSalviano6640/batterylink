import { useEffect, useRef, useState } from "react";
import { Bell, Check, MailWarning, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Notif = Tables<"notifications">;

export function NotificationsBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems(data ?? []);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((n) => !n.read_at).length;
  const visible = onlyUnread ? items.filter((notification) => !notification.read_at) : items;

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  };
  const markAll = async () => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null)
      .eq("user_id", userId);
  };
  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md border border-white/10 hover:bg-white/5"
        aria-label="Notificações"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-industrial text-[10px] font-mono flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-industrial border border-white/10 rounded-md shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-xs font-mono uppercase text-slate-400">Notificações</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="text-xs text-brand hover:brightness-125 inline-flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> marcar todas
              </button>
            )}
          </div>
          <div className="flex gap-2 px-3 py-2 border-b border-white/10 text-[10px]">
            <button
              onClick={() => setOnlyUnread(false)}
              className={!onlyUnread ? "text-brand" : "text-slate-500"}
            >
              Todas ({items.length})
            </button>
            <button
              onClick={() => setOnlyUnread(true)}
              className={onlyUnread ? "text-brand" : "text-slate-500"}
            >
              Não lidas ({unread})
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">Nenhuma notificação.</p>
            ) : (
              visible.map((n) => (
                <div
                  key={n.id}
                  className={`px-3 py-2 border-b border-white/5 flex gap-2 ${!n.read_at ? "bg-brand/5" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    {n.link ? (
                      <a
                        href={n.link}
                        onClick={() => void markRead(n.id)}
                        className="text-sm font-semibold truncate block hover:text-brand"
                      >
                        {n.title}
                      </a>
                    ) : (
                      <div className="text-sm font-semibold truncate">{n.title}</div>
                    )}
                    {n.body && <div className="text-xs text-slate-400 line-clamp-2">{n.body}</div>}
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </div>
                    {n.email_status === "integracao_pendente" && (
                      <div className="text-[9px] text-amber-300 mt-1 inline-flex items-center gap-1">
                        <MailWarning className="w-3 h-3" /> Integração de e-mail pendente
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!n.read_at && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="p-1 hover:bg-white/10 rounded"
                        title="Marcar como lida"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => remove(n.id)}
                      className="p-1 hover:bg-white/10 rounded text-slate-500"
                      title="Remover"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

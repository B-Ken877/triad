"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Composer } from "@/components/chat/Composer";
import { MessageList } from "@/components/chat/MessageList";
import type { ChatMessageView, ChatListStatus } from "@/components/chat/types";
import { newClientMsgId } from "@/lib/chat/client-msg-id";
import { signOut } from "@/lib/auth/client";
interface Channel { id: string; name: string; description: string | null; updatedAt: string }
interface PersistedMessage {
  id: string; channelId: string; senderId: string; clientMsgId: string | null; body: string;
  createdAt: string; sender: { id: string; name: string | null; email: string };
}
interface PendingBody { clientMsgId: string; body: string }
async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "The request could not be completed.");
  return payload;
}
function mapMessage(message: PersistedMessage, userId: string): ChatMessageView {
  return {
    id: message.id, senderId: message.senderId,
    senderName: message.sender.name ?? message.sender.email, text: message.body,
    createdAt: new Date(message.createdAt).getTime(), mine: message.senderId === userId,
    ...(message.clientMsgId ? { clientMsgId: message.clientMsgId } : {}),
  };
}
export function WorkspaceClient({ workspace, user }: {
  workspace: { id: string; name: string };
  user: { id: string; name: string | null; email: string };
}) {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [listStatus, setListStatus] = useState<ChatListStatus>("loading");
  const [channelError, setChannelError] = useState("");
  const [sendError, setSendError] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState<Record<string, PendingBody>>({});
  const activeChannel = useMemo(() => channels.find(channel => channel.id === activeId) ?? null, [channels, activeId]);

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ channels: Channel[] }>("/api/workspaces/" + workspace.id + "/channels")
      .then(data => {
        if (cancelled) return;
        setChannels(data.channels);
        setActiveId(current => data.channels.some(channel => channel.id === current) ? current : data.channels[0]?.id ?? "");
        setChannelError("");
      })
      .catch(error => {
        if (!cancelled) setChannelError(error instanceof Error ? error.message : "Unable to load channels.");
      })
      .finally(() => { if (!cancelled) setLoadingChannels(false); });
    return () => { cancelled = true; };
  }, [workspace.id]);

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    void requestJson<{ messages: PersistedMessage[] }>("/api/channels/" + activeId + "/messages")
      .then(data => {
        if (cancelled) return;
        setMessages(data.messages.map(message => mapMessage(message, user.id)));
        setListStatus("ready"); setPending({}); setSendError("");
      })
      .catch(error => {
        if (cancelled) return;
        setListStatus("error");
        setSendError(error instanceof Error ? error.message : "Unable to load messages.");
      });
    return () => { cancelled = true; };
  }, [activeId, user.id]);

  async function reloadMessages(channelId: string) {
    setListStatus("loading"); setSendError("");
    try {
      const data = await requestJson<{ messages: PersistedMessage[] }>("/api/channels/" + channelId + "/messages");
      setMessages(data.messages.map(message => mapMessage(message, user.id)));
      setListStatus("ready"); setPending({}); setSendError("");
    } catch (error) {
      setListStatus("error");
      setSendError(error instanceof Error ? error.message : "Unable to load messages.");
    }
  }

  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (name.length < 2 || creating) return;
    setCreating(true); setChannelError("");
    try {
      const data = await requestJson<{ channel: Channel }>("/api/workspaces/" + workspace.id + "/channels", {
        method: "POST", body: JSON.stringify({ name }),
      });
      setChannels(current => [data.channel, ...current]);
      setListStatus("loading"); setActiveId(data.channel.id); setNewName("");
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : "Unable to create the project.");
    } finally { setCreating(false); }
  }

  async function renameChannel(channel: Channel) {
    const nextName = window.prompt("Rename project", channel.name)?.trim();
    if (!nextName || nextName === channel.name) return;
    try {
      const data = await requestJson<{ channel: Channel }>("/api/channels/" + channel.id, {
        method: "PATCH", body: JSON.stringify({ name: nextName }),
      });
      setChannels(current => current.map(item => item.id === channel.id ? { ...item, ...data.channel } : item));
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : "Unable to rename the project.");
    }
  }

  async function sendMessage(body: string, retryId?: string) {
    if (!activeId) return;
    const clientMsgId = retryId ?? newClientMsgId();
    setSendError("");
    if (!retryId) {
      setPending(current => ({ ...current, [clientMsgId]: { clientMsgId, body } }));
      setMessages(current => [...current, {
        id: "local-" + clientMsgId, clientMsgId, senderId: user.id,
        senderName: user.name ?? user.email, text: body, createdAt: Date.now(), mine: true, state: "pending",
      }]);
    } else {
      // Check persisted history first if the original POST response was lost.
      try {
        const current = await requestJson<{ messages: PersistedMessage[] }>("/api/channels/" + activeId + "/messages");
        const existing = current.messages.find(message => message.clientMsgId === clientMsgId && message.senderId === user.id);
        if (existing) {
          setMessages(current.messages.map(message => mapMessage(message, user.id)));
          setPending(state => { const next = { ...state }; delete next[clientMsgId]; return next; });
          return;
        }
      } catch { /* continue; the POST response is authoritative */ }
    }
    try {
      const data = await requestJson<{ message: PersistedMessage }>("/api/channels/" + activeId + "/messages", {
        method: "POST", body: JSON.stringify({ body, clientMsgId }),
      });
      setMessages(current => current.map(message => message.clientMsgId === clientMsgId
        ? { ...mapMessage(data.message, user.id), state: "sent" } : message));
      setPending(state => { const next = { ...state }; delete next[clientMsgId]; return next; });
    } catch (error) {
      setMessages(current => current.map(message => message.clientMsgId === clientMsgId ? { ...message, state: "failed" } : message));
      setSendError(error instanceof Error ? error.message : "Message was not confirmed. You can retry it.");
    }
  }

  async function archiveChannel(channel: Channel) {
    if (!window.confirm("Archive “" + channel.name + "”? Its messages will be retained.")) return;
    try {
      await requestJson("/api/channels/" + channel.id, { method: "PATCH", body: JSON.stringify({ archive: true }) });
      setChannels(current => current.filter(item => item.id !== channel.id));
      if (activeId === channel.id) { setActiveId(""); setMessages([]); setListStatus("ready"); }
    } catch (error) {
      setChannelError(error instanceof Error ? error.message : "Unable to archive the project.");
    }
  }

  async function handleSignOut() {
    const result = await signOut();
    if (!result.ok) { setChannelError(result.message ?? "Could not sign out."); return; }
    router.replace("/auth/sign-in"); router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="min-w-0"><p className="text-sm font-bold tracking-[0.2em] text-emerald-700">TRIAD</p><p className="truncate text-xs text-neutral-500">{workspace.name}</p></div>
        <div className="flex items-center gap-3"><span className="hidden max-w-48 truncate text-sm text-neutral-500 sm:block">{user.name ?? user.email}</span><button onClick={handleSignOut} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800">Sign out</button></div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 flex items-center justify-between px-1"><h1 className="text-sm font-semibold">Projects</h1><span className="text-xs text-neutral-400">{channels.length}</span></div>
          <form onSubmit={createChannel} className="mb-4 space-y-2">
            <input value={newName} onChange={event => setNewName(event.target.value)} placeholder="New project name" maxLength={80} className="min-h-10 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-sm outline-none focus:border-emerald-700 dark:border-neutral-700" />
            <button disabled={creating || newName.trim().length < 2} className="min-h-9 w-full rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-50">{creating ? "Creating…" : "＋ Create project"}</button>
          </form>
          {channelError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{channelError}</p>}
          <nav aria-label="Project channels" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {loadingChannels ? <p className="px-2 py-3 text-xs text-neutral-500">Loading projects…</p> :
              channels.length === 0 ? <p className="px-2 py-3 text-xs leading-5 text-neutral-500">No projects yet. Create one to start a conversation.</p> :
              channels.map(channel => <div key={channel.id} className={"group flex items-center rounded-lg " + (activeId === channel.id ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}>
                <button onClick={() => { if (activeId === channel.id) reloadMessages(channel.id); else { setListStatus("loading"); setActiveId(channel.id); } }} className="min-w-0 flex-1 truncate px-3 py-2.5 text-left text-sm font-medium"># {channel.name}</button>
                <button title={"Rename " + channel.name} aria-label={"Rename " + channel.name} onClick={() => void renameChannel(channel)} className="rounded px-1.5 py-1 text-xs text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 dark:hover:bg-neutral-700">✎</button>
                <button title={"Archive " + channel.name} aria-label={"Archive " + channel.name} onClick={() => void archiveChannel(channel)} className="mr-1 rounded px-1.5 py-1 text-xs text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 dark:hover:bg-neutral-700">…</button>
              </div>)}
          </nav>
          <p className="mt-3 border-t border-neutral-200 px-2 pt-3 text-[11px] leading-4 text-neutral-400 dark:border-neutral-800">Private project channels. Access is checked on the server.</p>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          {activeChannel ? <>
            <div className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-6 dark:border-neutral-800 dark:bg-neutral-900">
              <h2 className="font-semibold">{activeChannel.name}</h2><p className="mt-1 text-xs text-neutral-500">{activeChannel.description || "Project conversation"}</p>
            </div>
            <MessageList messages={messages} status={listStatus} connection="online"
              emptyMessage="This project is ready. Send the first message to get the conversation started."
              formatDayLabel={date => new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)}
              formatTime={timestamp => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp)}
              onErrorRetry={() => reloadMessages(activeId)}
              onRetryMessage={clientMsgId => { const entry = pending[clientMsgId]; if (entry) void sendMessage(entry.body, clientMsgId); }} />
            <Composer onSend={body => sendMessage(body)} disabled={listStatus !== "ready"}
              disabledReason="Choose an active project to send messages." errorMessage={sendError || undefined} />
          </> : <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <h2 className="text-lg font-semibold">{loadingChannels ? "Loading your workspace…" : "Choose a project"}</h2>
            <p className="mt-2 max-w-sm text-sm text-neutral-500">Create a project channel or select one from the sidebar to start collaborating.</p>
          </div>}
        </section>
      </div>
    </main>
  );
}

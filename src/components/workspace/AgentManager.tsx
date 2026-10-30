"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type Channel = { id: string; name: string };
type Agent = {
  id: string; name: string; description: string | null; status: "ACTIVE" | "DISABLED";
  channels: { channel: Channel }[];
  keys: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[];
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Request failed.");
  return payload;
}
export function AgentManager({ workspaceId }: { workspaceId: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newKey, setNewKey] = useState("");
  const [keyNotice, setKeyNotice] = useState("");

  const refresh = useCallback(async () => {
    const [agentData, channelData] = await Promise.all([
      api<{ agents: Agent[] }>("/api/workspaces/" + workspaceId + "/agents"),
      api<{ channels: Channel[] }>("/api/workspaces/" + workspaceId + "/channels"),
    ]);
    setAgents(agentData.agents); setChannels(channelData.channels);
  }
  useEffect(() => {
    let active = true;
    void refresh().catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load agents."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspaceId]);

  async function createAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNewKey("");
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<{ agent: Agent; apiKey: string }>("/api/workspaces/" + workspaceId + "/agents", {
        method: "POST", body: JSON.stringify({ name, description, channelIds: selected }),
      });
      setNewKey(result.apiKey); setKeyNotice("Agent created. Copy this key now; it will never be displayed again.");
      setName(""); setDescription(""); setSelected([]); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create agent."); }
    finally { setBusy(false); }
  }
  async function rotate(agentId: string) {
    if (!window.confirm("Rotate this agent's API key? The previous key will stop working immediately.")) return;
    setBusy(true); setError("");
    try {
      const result = await api<{ apiKey: string }>("/api/agents/" + agentId + "/keys", { method: "POST" });
      setNewKey(result.apiKey); setKeyNotice("API key rotated. The previous key has been revoked. Copy this key now.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to rotate key."); }
    finally { setBusy(false); }
  }
  async function setStatus(agent: Agent, status: "ACTIVE" | "DISABLED") {
    setBusy(true); setError("");
    try {
      await api("/api/agents/" + agent.id, { method: "PATCH", body: JSON.stringify({ status }) });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update agent."); }
    finally { setBusy(false); }
  }
  async function revoke(agent: Agent) {
    if (!window.confirm("Disable " + agent.name + " and revoke all its API keys?")) return;
    setBusy(true); setError("");
    try { await api("/api/agents/" + agent.id, { method: "DELETE" }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to revoke agent."); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-8">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Integrations</p><h2 className="mt-1 text-2xl font-semibold">AI agents</h2><p className="mt-2 max-w-2xl text-sm text-neutral-500">Register independently hosted bots and give each one a dedicated credential with access limited to selected project channels.</p></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {newKey && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="font-semibold">Your API key — shown once</p><p className="mt-1 text-sm">{keyNotice}</p>
      <code className="mt-3 block break-all rounded-lg bg-white p-3 text-xs">{newKey}</code>
      <button onClick={() => void navigator.clipboard.writeText(newKey)} className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-sm font-semibold text-white">Copy API key</button>
      <button onClick={() => setNewKey("")} className="ml-2 rounded-lg border border-amber-400 px-3 py-2 text-sm">I saved it</button>
    </div>}
    <form onSubmit={createAgent} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="font-semibold">Register a new agent</h3>
      <input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={80} placeholder="Agent name (e.g. GLM Medika Agent)" className="min-h-11 w-full rounded-lg border border-neutral-300 bg-transparent px-3 text-sm dark:border-neutral-700"/>
      <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} placeholder="What will this agent do? (optional)" className="min-h-20 w-full rounded-lg border border-neutral-300 bg-transparent p-3 text-sm dark:border-neutral-700"/>
      <div><p className="mb-2 text-sm font-medium">Allow access to these project channels</p>
        {channels.length === 0 ? <p className="text-sm text-neutral-500">Create a project channel first.</p> : <div className="grid gap-2 sm:grid-cols-2">{channels.map(channel => <label key={channel.id} className="flex items-center gap-2 rounded-lg border border-neutral-200 p-2 text-sm dark:border-neutral-700"><input type="checkbox" checked={selected.includes(channel.id)} onChange={e => setSelected(current => e.target.checked ? [...current, channel.id] : current.filter(id => id !== channel.id))}/>{channel.name}</label>)}</div>}
      </div>
      <button disabled={busy || name.trim().length < 2 || selected.length === 0} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Working…" : "＋ Create agent & API key"}</button>
    </form>
    <section className="space-y-3"><h3 className="font-semibold">Registered agents</h3>
      {loading ? <p className="text-sm text-neutral-500">Loading agents…</p> : agents.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500">No agents registered yet. Create one above to generate its first API key.</p> : agents.map(agent => <article key={agent.id} className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-semibold">{agent.name}</h4><span className={"rounded-full px-2 py-0.5 text-xs " + (agent.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600")}>{agent.status.toLowerCase()}</span></div><p className="mt-1 text-sm text-neutral-500">{agent.description || "No description"}</p><p className="mt-2 text-xs text-neutral-500">Channels: {agent.channels.map(item => item.channel.name).join(", ")}</p></div>
          <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => void rotate(agent.id)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold dark:border-neutral-700">Rotate key</button><button disabled={busy} onClick={() => void setStatus(agent, agent.status === "ACTIVE" ? "DISABLED" : "ACTIVE")} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold dark:border-neutral-700">{agent.status === "ACTIVE" ? "Disable" : "Enable"}</button><button disabled={busy} onClick={() => void revoke(agent)} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-semibold text-red-700">Revoke</button></div>
        </div>
        <div className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800">{agent.keys.length ? agent.keys.map(key => <p key={key.id}>{key.name}: <code>{key.prefix}…</code> · created {new Date(key.createdAt).toLocaleDateString()}</p>) : "No active API keys"}</div>
      </article>)}
    </section>
  </div>;
}

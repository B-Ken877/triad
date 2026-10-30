import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { getOrCreateWorkspace } from "@/lib/workspace/access";
import { WorkspaceClient } from "@/components/workspace/WorkspaceClient";
export const dynamic = "force-dynamic";
export default async function WorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");
  let workspace;
  try {
    workspace = await getOrCreateWorkspace(user);
  } catch (error) {
    console.error("Workspace initialization failed:", error);
  }
  if (!workspace) return <main className="flex min-h-screen items-center justify-center px-6"><section className="max-w-md text-center">
    <h1 className="text-xl font-semibold">Workspace unavailable</h1>
    <p className="mt-2 text-sm text-neutral-500">TRIAD could not initialize your workspace. Check the database configuration and try again.</p>
  </section></main>;
  const role = workspace.members.find(member => member.userId === user.id)?.role ?? "MEMBER";
  return <WorkspaceClient workspace={{ id: workspace.id, name: workspace.name, role }} user={{ id: user.id, name: user.name, email: user.email }} />;
}

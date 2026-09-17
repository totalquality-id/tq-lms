import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-nav";
import { navigationFor, workspaceFor } from "@/lib/navigation";
import { home } from "@/lib/policy";
import { labels } from "@/lib/utils";
import { currentUser } from "@/services/access";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  const groups = navigationFor(user.role);
  const workspace = workspaceFor(user.role);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        user={{
          name: user.name,
          email: user.email,
          roleLabel: labels[user.role] ?? user.role,
        }}
        groups={groups}
        workspace={workspace}
        home={home(user.role)}
      />

      <div className="flex flex-1">
        <AppSidebar groups={groups} workspace={workspace} />

        <div className="flex min-w-0 flex-1 flex-col bg-ink-50">
          <main
            id="main-content"
            className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-safe sm:px-6 lg:px-8"
          >
            {children}
          </main>
          <footer className="no-print border-t border-ink-200 px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 text-xs text-ink-400">
              <span>
                © {new Date().getFullYear()} PT Total Quality Indonesia
              </span>
              <span>TQ Learning</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

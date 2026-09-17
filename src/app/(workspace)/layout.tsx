import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-nav";
import { navigationFor } from "@/lib/navigation";
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

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        user={{
          name: user.name,
          email: user.email,
          roleLabel: labels[user.role] ?? user.role,
        }}
        groups={groups}
        home={home(user.role)}
      />

      <div className="flex flex-1">
        <AppSidebar groups={groups} />

        <div className="flex min-w-0 flex-1 flex-col">
          <main
            id="main-content"
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-safe"
          >
            {children}
          </main>
          <footer className="no-print border-t border-ink-200 py-4 text-center text-xs text-ink-400">
            Total Quality Learning · PT Total Quality Indonesia
          </footer>
        </div>
      </div>
    </div>
  );
}

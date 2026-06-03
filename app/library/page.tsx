import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import {
  demoGameMetadata,
  demoLibraryEntries,
  demoUsers,
  getGameById,
  getPlatformById,
} from "@/lib/demo-data";

export default function LibraryPage() {
  return (
    <AppShell
      activeRoute="/library"
      title="Library browser placeholder"
      description="The collection view stays light and readable. It exists to support curation signals like duplicate ownership, family overlap, and dormant backlog pockets."
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel className="space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
              Collection snapshot
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Ownership grouped by platform
            </h2>
          </div>

          <div className="space-y-3">
            {demoLibraryEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-black/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-white">
                    {getGameById(entry.gameId).canonicalTitle}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {getPlatformById(entry.platformId).name} • owned by{" "}
                    {demoUsers.find((user) => user.id === entry.userId)?.displayName}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-zinc-300">
                  {entry.playStatus}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
              Collection intelligence
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Duplicate-aware metadata
            </h2>
          </div>
          <div className="space-y-3">
            {demoGameMetadata.map((metadata) => (
              <div
                key={metadata.gameId}
                className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4"
              >
                <p className="font-medium text-white">
                  {getGameById(metadata.gameId).canonicalTitle}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {metadata.mood}
                </p>
                {metadata.duplicateOwnershipNote ? (
                  <p className="mt-2 text-sm text-indigo-200">
                    {metadata.duplicateOwnershipNote}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

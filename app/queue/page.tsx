import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import { demoLibraryEntries, getGameById, getPlatformById } from "@/lib/demo-data";

const sections = [
  { status: "active", label: "Active now" },
  { status: "next_up", label: "Next up" },
  { status: "backlog", label: "Backlog candidates" },
];

export default function QueuePage() {
  return (
    <AppShell
      activeRoute="/queue"
      title="Active rotation and queue"
      description="Backlog Pilot treats the queue as a curatorial tool. The point is to narrow choices down, not preserve every possibility forever."
    >
      <div className="grid gap-6 xl:grid-cols-3">
        {sections.map((section) => (
          <Panel key={section.status} className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
                {section.label}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {demoLibraryEntries.filter((entry) => entry.playStatus === section.status).length}{" "}
                games
              </h2>
            </div>

            <div className="space-y-3">
              {demoLibraryEntries
                .filter((entry) => entry.playStatus === section.status)
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4"
                  >
                    <p className="font-medium text-white">
                      {getGameById(entry.gameId).title}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      {getPlatformById(entry.platformId).name} • owned {entry.ownedDays} days
                    </p>
                  </div>
                ))}
            </div>
          </Panel>
        ))}
      </div>
    </AppShell>
  );
}

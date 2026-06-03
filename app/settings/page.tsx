import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/panel";
import { aiArchitectureNotes } from "@/lib/ai/agents";

const settingsSections = [
  {
    title: "Household and workspace model",
    body: "The scaffold avoids assuming one permanent user. Users belong to a shared household, and library entries stay user-specific so shared recommendations can be layered on later.",
  },
  {
    title: "Persistence mode",
    body: "Prisma schema is included now, but the UI runs on deterministic demo data so onboarding, route placeholders, and recommendation surfaces work locally without auth or importer dependencies.",
  },
  {
    title: "Importer readiness",
    body: "Steam, Switch, GBA, PSP, and PSVita are all first-class route and data-model concerns from the initial scaffold onward.",
  },
];

export default function SettingsPage() {
  return (
    <AppShell
      activeRoute="/settings"
      title="Settings and architecture placeholders"
      description="This screen documents what is already wired conceptually: multi-user support, persistence boundaries, and the initial AI abstraction layer."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <div className="grid gap-6">
          {settingsSections.map((section) => (
            <Panel key={section.title} className="space-y-3">
              <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
                Foundation
              </p>
              <h2 className="text-2xl font-semibold text-white">{section.title}</h2>
              <p className="text-sm leading-6 text-zinc-400">{section.body}</p>
            </Panel>
          ))}
        </div>

        <Panel className="space-y-4">
          <p className="text-sm uppercase tracking-[0.24em] text-zinc-400">
            AI architecture notes
          </p>
          <div className="space-y-3">
            {aiArchitectureNotes.map((note) => (
              <div
                key={note}
                className="rounded-2xl border border-white/8 bg-black/20 px-4 py-4 text-sm leading-6 text-zinc-300"
              >
                {note}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

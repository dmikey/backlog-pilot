"use client";

import { useState } from "react";

import type { PlayTonightAction } from "@/lib/play-tonight/types";

const actionButtons: Array<{ action: PlayTonightAction; label: string }> = [
  { action: "play_this", label: "Play This" },
  { action: "not_interested", label: "Not Interested" },
  { action: "remind_me_later", label: "Remind Me Later" },
  { action: "already_playing", label: "Already Playing" },
  { action: "finished_it", label: "Finished It" },
];

export function PlayTonightFeedbackActions({
  userId,
  recommendationId,
  gameId,
  platform,
  sessionOptionId,
}: {
  userId: string;
  recommendationId: string;
  gameId: string;
  platform: string;
  sessionOptionId: string;
}) {
  const [activeAction, setActiveAction] = useState<PlayTonightAction | null>(null);

  async function handleAction(action: PlayTonightAction) {
    setActiveAction(action);

    try {
      await fetch("/api/play-tonight/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId,
          recommendationId,
          action,
          gameId,
          platform,
          sessionOptionId,
        }),
      });
    } catch {
      setActiveAction(null);
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {actionButtons.map((button) => (
        <button
          key={button.action}
          type="button"
          onClick={() => handleAction(button.action)}
          className={`rounded-xl border px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] transition ${
            activeAction === button.action
              ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
              : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:bg-white/10"
          }`}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

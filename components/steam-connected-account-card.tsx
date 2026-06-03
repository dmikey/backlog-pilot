"use client";

import { useState } from "react";

interface SteamConnectionStatus {
  connected: boolean;
  steamId?: string;
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  status: string;
}

const defaultUserId = "user-derek";

export function SteamConnectedAccountCard() {
  const [userId, setUserId] = useState(defaultUserId);
  const [status, setStatus] = useState<SteamConnectionStatus>({
    connected: false,
    status: "Unlinked",
  });

  async function loadStatus(nextUserId = userId) {
    const response = await fetch(`/accounts/steam?userId=${encodeURIComponent(nextUserId)}`);
    const json = (await response.json()) as SteamConnectionStatus;
    setStatus(json);
  }

  async function disconnect() {
    if (!status.steamId) {
      return;
    }

    await fetch(
      `/accounts/steam?userId=${encodeURIComponent(userId)}&steamId=${encodeURIComponent(status.steamId)}`,
      { method: "DELETE" },
    );

    await loadStatus();
  }

  const connectUrl = `/auth/steam?userId=${encodeURIComponent(userId)}`;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-zinc-400">
        Connect Steam with OpenID. This links identity only and prepares account records for future library sync.
      </p>
      <label className="flex flex-col gap-2 text-sm text-zinc-300">
        User ID
        <input
          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/40"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="rounded-lg border border-white/20 px-3 py-1 text-xs text-zinc-100"
        onClick={() => void loadStatus(userId)}
      >
        Refresh status
      </button>
      {status.connected ? (
        <div className="space-y-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-3">
            {status.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={status.avatarUrl} alt="Steam avatar" className="h-12 w-12 rounded-full" />
            ) : null}
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">{status.displayName}</p>
              <p className="text-xs text-zinc-300">Status: {status.status}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {status.profileUrl ? (
              <a
                href={status.profileUrl}
                className="text-xs text-emerald-200 underline"
                rel="noreferrer"
                target="_blank"
              >
                View profile
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => void disconnect()}
              className="rounded-lg border border-white/20 px-3 py-1 text-xs text-zinc-100"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <a
          href={connectUrl}
          className="inline-flex rounded-lg border border-white/20 px-3 py-2 text-xs font-medium text-zinc-100"
        >
          Connect Steam
        </a>
      )}
    </div>
  );
}

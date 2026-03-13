"use client";

import { useEffect, useMemo, useState } from "react";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { User } from "@/types/user";
import type { Conversation } from "@/types/conversation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { conversationsApi, usersApi } from "@/services/api";
import { queryKeys } from "@/services/query/queryKeys";
import { cn } from "@/utils/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  onOpenConversation: (conversation: Conversation) => void;
}

export function CreateConversationDialog({ open, onClose, onOpenConversation }: Props): JSX.Element | null {
  const [type, setType] = useState<"direct" | "group">("direct");
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User[]>([]);
  const debSearch = useDebouncedValue(search.trim(), 250);

  const usersQuery = useQuery({
    queryKey: queryKeys.searchUsers(debSearch.toLowerCase()),
    queryFn: () => usersApi.search({ q: debSearch || undefined, limit: 30, offset: 0 }),
    enabled: open,
    staleTime: 30_000,
  });
  const users = usersQuery.data ?? [];

  useEffect(() => {
    if (type === "direct" && selected.length > 1) setSelected((p) => p.slice(0, 1));
  }, [type, selected.length]);

  function reset() {
    setType("direct");
    setTitle("");
    setSearch("");
    setSelected([]);
  }

  function close() { reset(); onClose(); }

  function toggle(user: User) {
    setSelected((prev) => {
      const exists = prev.some((u) => u.id === user.id);
      if (exists) return prev.filter((u) => u.id !== user.id);
      return type === "direct" ? [user] : [...prev, user];
    });
  }

  const mutation = useMutation({
    mutationFn: () =>
      conversationsApi.create({
        type,
        title: type === "group" ? title : undefined,
        participant_ids: selected.map((u) => u.id),
      }),
    onSuccess: (conv) => {
      toast.success(type === "direct" ? "Chat opened" : "Group created");
      onOpenConversation(conv);
      close();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed"),
  });

  const disabled = useMemo(() => {
    if (mutation.isPending) return true;
    if (type === "direct") return selected.length !== 1;
    return !title.trim() || selected.length < 1;
  }, [mutation.isPending, type, selected.length, title]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-[448px] overflow-hidden rounded-2xl shadow-2xl"
        style={{ background: "var(--card)" }}
      >
        {/* Header */}
        <div
          className="relative flex items-center justify-center border-b px-4 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <h3 className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>
            New message
          </h3>
          <button
            type="button"
            onClick={close}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full transition"
            style={{ background: "var(--surface)", color: "var(--fg)" }}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          {/* Type toggle */}
          <div
            className="flex gap-1 rounded-xl p-1"
            style={{ background: "var(--surface)" }}
          >
            {(["direct", "group"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className="flex-1 rounded-lg py-2 text-[14px] font-semibold capitalize transition"
                style={
                  type === t
                    ? { background: "var(--card)", color: "var(--fg)", boxShadow: "0 1px 4px rgba(0,0,0,.08)" }
                    : { color: "var(--fg-secondary)" }
                }
              >
                {t}
              </button>
            ))}
          </div>

          {/* Group title */}
          {type === "group" && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Group name"
              className="w-full rounded-xl border px-4 py-2.5 text-[15px] outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--fg)" }}
            />
          )}

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--fg-secondary)" }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people"
              className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-[15px] outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--fg)" }}
            />
          </div>

          {/* Selected tags */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold"
                  style={{ background: "var(--surface-active)", color: "var(--blue)" }}
                >
                  {u.username}
                  <button type="button" onClick={() => toggle(u)} className="rounded-full p-0.5">
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* User list */}
          <div
            className="max-h-52 overflow-y-auto rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          >
            {usersQuery.isLoading && (
              <p className="px-4 py-3 text-[13px]" style={{ color: "var(--fg-secondary)" }}>Loading…</p>
            )}
            {!usersQuery.isLoading && users.length === 0 && (
              <p className="px-4 py-3 text-[13px]" style={{ color: "var(--fg-secondary)" }}>No users found</p>
            )}
            {users.map((user) => {
              const sel = selected.some((u) => u.id === user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggle(user)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition"
                  style={{ background: sel ? "var(--surface-active)" : "transparent" }}
                  onMouseEnter={(e) => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)"; }}
                  onMouseLeave={(e) => { if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white"
                    style={{ background: sel ? "var(--blue)" : "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold truncate" style={{ color: sel ? "var(--blue)" : "var(--fg)" }}>
                      {user.username}
                    </p>
                    <p className="truncate text-[12px]" style={{ color: "var(--fg-secondary)" }}>
                      {user.email}
                    </p>
                  </div>
                  {sel && (
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: "var(--blue)" }}
                    >
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[12px]" style={{ color: "var(--fg-secondary)" }}>
            {type === "direct" ? "Select one person to open a direct chat." : "Select one or more people for a group."}
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 border-t px-4 py-3"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-xl border py-2.5 text-[15px] font-semibold transition"
            style={{ borderColor: "var(--border)", color: "var(--fg)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={disabled}
            className="flex-1 rounded-xl py-2.5 text-[15px] font-semibold text-white transition"
            style={{ background: disabled ? "#4da6ff" : "var(--blue)", cursor: disabled ? "not-allowed" : "pointer" }}
          >
            {mutation.isPending ? "Opening…" : "Open chat"}
          </button>
        </div>
      </div>
    </div>
  );
}

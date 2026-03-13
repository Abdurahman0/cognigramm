"use client";

import { useEffect, useMemo, useState } from "react";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { User } from "@/types/user";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { conversationsApi, usersApi } from "@/services/api";
import { queryKeys } from "@/services/query/queryKeys";
import { useConversationStore } from "@/store/conversationStore";
import { cn } from "@/utils/cn";

interface CreateConversationDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateConversationDialog({ open, onClose }: CreateConversationDialogProps): JSX.Element | null {
  const queryClient = useQueryClient();
  const upsertConversation = useConversationStore((state) => state.upsertConversation);
  const [type, setType] = useState<"direct" | "group">("direct");
  const [title, setTitle] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 250);

  const usersQuery = useQuery({
    queryKey: queryKeys.searchUsers(debouncedSearch.toLowerCase()),
    queryFn: () => usersApi.search({ q: debouncedSearch || undefined, limit: 30, offset: 0 }),
    enabled: open,
    staleTime: 30_000
  });

  const users = usersQuery.data ?? [];

  useEffect(() => {
    if (type === "direct" && selectedUsers.length > 1) {
      setSelectedUsers((prev) => prev.slice(0, 1));
    }
  }, [selectedUsers.length, type]);

  const resetForm = () => {
    setType("direct");
    setTitle("");
    setSearchInput("");
    setSelectedUsers([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleUserSelection = (user: User) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((item) => item.id === user.id);
      if (exists) return prev.filter((item) => item.id !== user.id);
      if (type === "direct") return [user];
      return [...prev, user];
    });
  };

  const mutation = useMutation({
    mutationFn: async () =>
      conversationsApi.create({
        type,
        title: type === "group" ? title : undefined,
        participant_ids: selectedUsers.map((item) => item.id)
      }),
    onSuccess: (conversation) => {
      upsertConversation(conversation);
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations }).catch(() => undefined);
      toast.success("Conversation created");
      handleClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create conversation");
    }
  });

  const isCreateDisabled = useMemo(() => {
    if (type === "direct") return selectedUsers.length !== 1 || mutation.isPending;
    return !title.trim() || selectedUsers.length < 1 || mutation.isPending;
  }, [mutation.isPending, selectedUsers.length, title, type]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[448px] overflow-hidden rounded-2xl bg-[var(--card)] shadow-2xl">
        {/* Header */}
        <div className="relative flex items-center justify-center border-b border-[var(--border)] px-4 py-4">
          <h3 className="text-[18px] font-bold text-[var(--foreground)]">New message</h3>
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--messenger-hover)]"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Type selector */}
          <div className="flex gap-2 rounded-xl bg-[var(--secondary)] p-1">
            <button
              type="button"
              onClick={() => setType("direct")}
              className={cn(
                "flex-1 rounded-lg py-2 text-[14px] font-semibold transition",
                type === "direct"
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              Direct
            </button>
            <button
              type="button"
              onClick={() => setType("group")}
              className={cn(
                "flex-1 rounded-lg py-2 text-[14px] font-semibold transition",
                type === "group"
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              )}
            >
              Group
            </button>
          </div>

          {/* Group title */}
          {type === "group" && (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Group name"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-2.5 text-[15px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[#0084ff] focus:ring-2 focus:ring-[#0084ff]/20"
            />
          )}

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search people"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] pl-9 pr-4 py-2.5 text-[15px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[#0084ff] focus:ring-2 focus:ring-[#0084ff]/20"
            />
          </div>

          {/* Selected users tags */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((user) => (
                <span
                  key={user.id}
                  className="inline-flex items-center gap-1 rounded-full bg-[#e7f3ff] px-3 py-1 text-[13px] font-semibold text-[#0084ff]"
                >
                  {user.username}
                  <button
                    type="button"
                    onClick={() => toggleUserSelection(user)}
                    className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0084ff]/20 text-[#0084ff] hover:bg-[#0084ff]/30"
                  >
                    <XMarkIcon className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* User list */}
          <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--border)]">
            {usersQuery.isLoading && (
              <p className="px-4 py-3 text-[13px] text-[var(--muted)]">Loading...</p>
            )}
            {!usersQuery.isLoading && users.length === 0 && (
              <p className="px-4 py-3 text-[13px] text-[var(--muted)]">No users found</p>
            )}
            {users.map((user) => {
              const selected = selectedUsers.some((item) => item.id === user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUserSelection(user)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition",
                    selected
                      ? "bg-[#e7f3ff]"
                      : "hover:bg-[var(--messenger-hover)]"
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white",
                    selected ? "bg-[#0084ff]" : "bg-gradient-to-br from-[#60a5fa] to-[#3b82f6]"
                  )}>
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-[15px] font-semibold", selected ? "text-[#0084ff]" : "text-[var(--foreground)]")}>
                      {user.username}
                    </p>
                    <p className="truncate text-[12px] text-[var(--muted)]">{user.email}</p>
                  </div>
                  {selected && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0084ff]">
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[12px] text-[var(--muted)]">
            {type === "direct" ? "Select one person to start a chat." : "Select one or more people for a group chat."}
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-[15px] font-semibold text-[var(--foreground)] hover:bg-[var(--secondary)] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={isCreateDisabled}
            className="flex-1 rounded-xl bg-[#0084ff] py-2.5 text-[15px] font-semibold text-white transition hover:bg-[#0073e6] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Creating..." : "Open chat"}
          </button>
        </div>
      </div>
    </div>
  );
}

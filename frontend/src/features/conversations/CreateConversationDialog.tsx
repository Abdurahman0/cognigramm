"use client";

import { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { User } from "@/types/user";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { conversationsApi, usersApi } from "@/services/api";
import { queryKeys } from "@/services/query/queryKeys";
import { useConversationStore } from "@/store/conversationStore";

interface CreateConversationDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateConversationDialog({ open, onClose }: CreateConversationDialogProps): JSX.Element | null {
  const queryClient = useQueryClient();
  const upsertConversation = useConversationStore((state) => state.upsertConversation);
  const [type, setType] = useState<"direct" | "group">("group");
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
    setType("group");
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
      if (exists) {
        return prev.filter((item) => item.id !== user.id);
      }
      if (type === "direct") {
        return [user];
      }
      return [...prev, user];
    });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      return conversationsApi.create({
        type,
        title: type === "group" ? title : undefined,
        participant_ids: selectedUsers.map((item) => item.id)
      });
    },
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
    if (type === "direct") {
      return selectedUsers.length !== 1 || mutation.isPending;
    }
    return !title.trim() || selectedUsers.length < 1 || mutation.isPending;
  }, [mutation.isPending, selectedUsers.length, title, type]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-soft-lg dark:bg-slate-900">
        <h3 className="text-lg font-semibold">New Conversation</h3>
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setType("direct")}
              className={`rounded-lg px-3 py-2 text-sm ${type === "direct" ? "bg-accent-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
            >
              Direct
            </button>
            <button
              onClick={() => setType("group")}
              className={`rounded-lg px-3 py-2 text-sm ${type === "group" ? "bg-accent-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
            >
              Group
            </button>
          </div>
          {type === "group" ? (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Group title"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          ) : null}
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search users by username or email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          />
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            {usersQuery.isLoading ? <p className="px-2 py-1 text-sm text-slate-500">Loading users...</p> : null}
            {!usersQuery.isLoading && users.length === 0 ? (
              <p className="px-2 py-1 text-sm text-slate-500">No users found</p>
            ) : null}
            {users.map((user) => {
              const selected = selectedUsers.some((item) => item.id === user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleUserSelection(user)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm ${
                    selected
                      ? "bg-accent-600/10 text-accent-700 dark:bg-accent-500/20 dark:text-accent-300"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span className="truncate">{user.username}</span>
                  <span className="truncate text-xs text-slate-500">{user.email}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <span
                key={user.id}
                className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {user.username}
                <button
                  type="button"
                  onClick={() => toggleUserSelection(user)}
                  className="rounded-full p-0.5 hover:bg-slate-300/70 dark:hover:bg-slate-700/70"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {type === "direct" ? "Choose exactly one user for direct chat." : "Choose one or more users for group chat."}
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={handleClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            className="rounded-lg bg-accent-600 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isCreateDisabled}
          >
            {mutation.isPending ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

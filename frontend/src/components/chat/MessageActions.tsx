"use client";

import { useEffect, useRef, useState } from "react";
import { PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

import { cn } from "@/utils/cn";

interface MessageActionsProps {
  isOwn: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function MessageActions({ isOwn, onEdit, onDelete }: MessageActionsProps): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  if (!isOwn) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center justify-center rounded-full p-1.5 transition-opacity",
          "opacity-100 md:opacity-0 md:group-hover:opacity-100",
          "text-[var(--muted)] hover:bg-[var(--secondary)]",
          isOpen ? "md:opacity-100" : ""
        )}
        aria-label="Message actions"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div
            className={cn(
              "absolute right-0 z-20 min-w-[140px] rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg",
              "animate-in fade-in zoom-in-95 duration-150"
            )}
          >
            <button
              onClick={() => {
                onEdit();
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px]",
                "text-[var(--foreground)] hover:bg-[var(--secondary)]",
                "transition-colors"
              )}
            >
              <PencilIcon className="h-4 w-4" />
              Edit
            </button>
            <button
              onClick={() => {
                onDelete();
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20",
                "transition-colors"
              )}
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

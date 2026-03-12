import { format, formatDistanceToNowStrict } from "date-fns";

export function formatMessageTime(value: string): string {
  return format(new Date(value), "HH:mm");
}

export function formatMessageDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

export function formatLastSeen(value: string | null | undefined): string {
  if (!value) {
    return "last seen recently";
  }
  const date = new Date(value);
  return `last seen ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}

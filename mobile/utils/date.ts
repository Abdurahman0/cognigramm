import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from "date-fns";

export const formatChatTimestamp = (iso: string): string => {
  const date = parseISO(iso);
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "MMM d");
};

export const formatMessageDate = (iso: string): string => format(parseISO(iso), "MMM d, HH:mm");

export const formatRelative = (iso: string): string =>
  formatDistanceToNowStrict(parseISO(iso), { addSuffix: true });

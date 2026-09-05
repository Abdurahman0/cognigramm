import { format, formatDistanceToNowStrict, isThisYear, isToday, isYesterday } from 'date-fns'

const parse = (value: string | number | Date): Date =>
  value instanceof Date ? value : new Date(value)

/** Bubble timestamp: the clock is enough, the date lives in the day divider. */
export const formatTime = (value: string | Date): string => format(parse(value), 'HH:mm')

/** List timestamp: as coarse as it can be while still being unambiguous. */
export const formatListTime = (value: string | Date): string => {
  const date = parse(value)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Yesterday'
  if (isThisYear(date)) return format(date, 'd MMM')
  return format(date, 'dd.MM.yy')
}

export const formatDayDivider = (value: string | Date): string => {
  const date = parse(value)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (isThisYear(date)) return format(date, 'EEEE, d MMMM')
  return format(date, 'd MMMM yyyy')
}

export const formatLastSeen = (value: string | null): string => {
  if (!value) return 'offline'
  return `last seen ${formatDistanceToNowStrict(parse(value), { addSuffix: true })}`
}

/** mm:ss, or h:mm:ss once a call runs past an hour. */
export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  const pad = (value: number) => value.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export const sameDay = (a: string | Date, b: string | Date): boolean =>
  format(parse(a), 'yyyy-MM-dd') === format(parse(b), 'yyyy-MM-dd')

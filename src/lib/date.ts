import { enGB } from 'date-fns/locale'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'

const WEEK_OPTIONS = { weekStartsOn: 1 as const, locale: enGB }

export const MIN_PLANNER_DATE = new Date(2020, 0, 1)
export const MAX_PLANNER_DATE = new Date(2030, 11, 31)

export function clampToPlannerRange(date: Date) {
  if (date.getTime() < MIN_PLANNER_DATE.getTime()) {
    return new Date(MIN_PLANNER_DATE)
  }
  if (date.getTime() > MAX_PLANNER_DATE.getTime()) {
    return new Date(MAX_PLANNER_DATE)
  }
  return date
}

export function formatDate(date: Date | string, dateFormat = 'd MMM yyyy') {
  const value = typeof date === 'string' ? parseISO(date) : date
  return format(value, dateFormat, WEEK_OPTIONS)
}

export function getMonthMatrix(activeDate: Date) {
  const start = startOfWeek(startOfMonth(activeDate), WEEK_OPTIONS)
  const end = endOfWeek(endOfMonth(activeDate), WEEK_OPTIONS)
  const days = eachDayOfInterval({ start, end })
  const weeks: Date[][] = []

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }

  return weeks
}

export function getWeekDays(activeDate: Date) {
  const start = startOfWeek(activeDate, WEEK_OPTIONS)
  const end = endOfWeek(activeDate, WEEK_OPTIONS)
  return eachDayOfInterval({ start, end })
}

export function getThisWeekRange(baseDate = new Date()) {
  const start = startOfWeek(baseDate, WEEK_OPTIONS)
  const end = endOfWeek(baseDate, WEEK_OPTIONS)
  return { start, end }
}

export function getNextTwoWeeksRange(baseDate = new Date()) {
  const start = startOfWeek(baseDate, WEEK_OPTIONS)
  const end = endOfWeek(addWeeks(baseDate, 1), WEEK_OPTIONS)
  return { start, end }
}

export function getThisMonthRange(baseDate = new Date()) {
  const start = startOfMonth(baseDate)
  const end = endOfMonth(baseDate)
  return { start, end }
}

export function getNextMonthRange(baseDate = new Date()) {
  const next = addMonths(baseDate, 1)
  const { start, end } = getThisMonthRange(next)
  return { start, end }
}

export function getMonthRangeFor(date: Date) {
  const start = startOfMonth(date)
  const end = endOfMonth(date)
  return { start, end }
}

export function getWeekRangeFor(date: Date) {
  const start = startOfWeek(date, WEEK_OPTIONS)
  const end = endOfWeek(date, WEEK_OPTIONS)
  return { start, end }
}

export function getAdjacentDay(date: Date, delta: number) {
  return addDays(date, delta)
}

export function getAdjacentWeek(date: Date, delta: number) {
  return addDays(date, delta * 7)
}

export function getDayBefore(date: Date) {
  return subDays(date, 1)
}

export function getDayAfter(date: Date) {
  return addDays(date, 1)
}

export function sameDay(a: Date | string, b: Date | string) {
  const first = typeof a === 'string' ? parseISO(a) : a
  const second = typeof b === 'string' ? parseISO(b) : b
  return isSameDay(first, second)
}

export function sameMonth(a: Date, b: Date) {
  return isSameMonth(a, b)
}

export const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, index) =>
  format(addDays(startOfWeek(new Date(), WEEK_OPTIONS), index), 'EEE', WEEK_OPTIONS),
)

export const MONTH_LABEL_FORMAT = 'MMMM yyyy'

import { Link } from 'react-router-dom';
import Icon from './Icon';
import type { CalendarDay, DayStatus } from '../game/calendar.ts';
import { formatDate, seedForDate } from '../game/dates.ts';

export type CalendarFilter = 'all' | 'won' | 'lost' | 'missed';

type ArchiveCalendarProps = {
  days: CalendarDay[];
  // Blank cells before the 1st (Sunday-first)
  offset: number;
  filter: CalendarFilter;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayText(day: CalendarDay): { label: string; detail: string } {
  const { attempt } = day;
  switch (day.status) {
    case 'won': return { label: 'Won', detail: `${attempt?.efficiency ?? 0}% efficiency` };
    case 'lost': return { label: 'Lost', detail: `${attempt?.completionPercentage ?? 0}% cleared` };
    case 'progress': return { label: 'In progress', detail: 'Resume' };
    case 'today': return { label: 'Today', detail: 'Not played yet' };
    case 'missed': return { label: 'Missed', detail: '' };
    default: return { label: '', detail: '' };
  }
}

function matches(status: DayStatus, filter: CalendarFilter) {
  return filter === 'all' || status === filter;
}

// One month of daily boards. Past days link to their board; future days
// are locked; days before launch (or before the account) are blank.
export default function ArchiveCalendar({ days, offset, filter }: ArchiveCalendarProps) {
  return (
    <div className="calendar">
      <div className="calendar-row" aria-hidden="true">
        {WEEKDAYS.map((weekday) => <span className="calendar-dow" key={weekday}>{weekday}</span>)}
      </div>
      <div className="calendar-days" aria-label="Daily boards by date" role="group">
        {Array.from({ length: offset }, (_, index) => <span key={`blank-${index}`} className="calendar-day day-blank" aria-hidden="true" />)}
        {days.map((day) => {
          const number = Number(day.date.slice(8));
          const { label, detail } = dayText(day);
          const dim = !matches(day.status, filter) && day.status !== 'future' && day.status !== 'unavailable';
          const className = `calendar-day day-${day.status}${dim ? ' day-dim' : ''}`;
          const dateLabel = formatDate(day.date, 'weekdayLong');

          if (day.status === 'future') {
            return (
              <span key={day.date} className={className} aria-label={`${dateLabel}: locked until this day`}>
                <span className="day-number">{number}</span>
                <Icon name="lock" size={16} className="day-lock" />
              </span>
            );
          }
          if (day.status === 'unavailable') {
            return (
              <span key={day.date} className={className} aria-label={`${dateLabel}: not available`}>
                <span className="day-number">{number}</span>
              </span>
            );
          }
          return (
            <Link
              key={day.date}
              className={className}
              to={day.status === 'today' ? '/play' : `/archive/${seedForDate(day.date)}`}
              aria-label={`${dateLabel}: ${label}${detail ? `, ${detail}` : ''}`}
            >
              <span className="day-number">{number}</span>
              <span className="day-text">
                <span className="day-label">{label}</span>
                {detail && <span className="day-detail">{detail}</span>}
              </span>
              {day.status === 'missed' && <span className="day-pill" aria-hidden="true">Play</span>}
            </Link>
          );
        })}
      </div>
      <div className="calendar-legend" aria-hidden="true">
        <span><i className="legend-won" />Won</span>
        <span><i className="legend-lost" />Lost</span>
        <span><i className="legend-progress" />In progress</span>
        <span><i className="legend-missed" />Missed</span>
        <span><i className="legend-today" />Today</span>
        <span><Icon name="lock" size={13} />Locked</span>
      </div>
    </div>
  );
}

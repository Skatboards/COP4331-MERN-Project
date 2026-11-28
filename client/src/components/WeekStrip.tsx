import { Link } from 'react-router-dom';
import Icon from './Icon';
import type { CalendarDay } from '../game/calendar.ts';
import { formatDate, seedForDate } from '../game/dates.ts';

const MARKS: Record<string, string> = { won: '✓', lost: '✕', progress: '…', missed: '!', today: '•' };

// The last seven days as small linked tiles
export default function WeekStrip({ days }: { days: CalendarDay[] }) {
  return (
    <ol className="week-strip">
      {days.map((day) => {
        const status = day.status === 'unavailable' ? 'Not available' : day.status === 'progress' ? 'In progress' : day.status[0].toUpperCase() + day.status.slice(1);
        const content = (
          <>
            <span className="week-day">{formatDate(day.date, 'weekday')}</span>
            <span className="week-mark" aria-hidden="true">{day.status === 'future' ? <Icon name="lock" size={13} /> : MARKS[day.status] ?? ''}</span>
          </>
        );
        return (
          <li key={day.date}>
            {day.status === 'unavailable' || day.status === 'future'
              ? <span className={`week-tile day-${day.status}`} aria-label={`${formatDate(day.date, 'weekdayLong')}: ${status}`}>{content}</span>
              : <Link className={`week-tile day-${day.status}`} to={day.status === 'today' ? '/play' : `/archive/${seedForDate(day.date)}`} aria-label={`${formatDate(day.date, 'weekdayLong')}: ${status}`}>{content}</Link>}
          </li>
        );
      })}
    </ol>
  );
}

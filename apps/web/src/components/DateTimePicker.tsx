"use client";

import { forwardRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface DateTimePickerProps {
  selected: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  placeholder?: string;
  className?: string;
}

// Custom input for date picker
const DateInput = forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: () => void; placeholder?: string }
>(({ value, onClick, placeholder }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-left text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors flex items-center justify-between"
  >
    <span className={value ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
      {value || placeholder || "Select date..."}
    </span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--muted)]"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  </button>
));

DateInput.displayName = "DateInput";

// Custom input for time picker
const TimeInput = forwardRef<
  HTMLButtonElement,
  { value?: string; onClick?: () => void; placeholder?: string }
>(({ value, onClick, placeholder }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm text-left text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors flex items-center justify-between"
  >
    <span className={value ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
      {value || placeholder || "Select time..."}
    </span>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--muted)]"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  </button>
));

TimeInput.displayName = "TimeInput";

export default function DateTimePicker({
  selected,
  onChange,
  minDate,
}: DateTimePickerProps) {
  // Handle date change (preserve existing time if set)
  const handleDateChange = (date: Date | null) => {
    if (!date) {
      onChange(null);
      return;
    }
    
    if (selected) {
      // Preserve the existing time
      date.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    } else {
      // Default to current time rounded to next 15 min interval
      const now = new Date();
      const minutes = Math.ceil(now.getMinutes() / 15) * 15;
      date.setHours(now.getHours(), minutes, 0, 0);
      if (minutes >= 60) {
        date.setHours(date.getHours() + 1, 0, 0, 0);
      }
    }
    onChange(date);
  };

  // Handle time change (preserve existing date)
  const handleTimeChange = (time: Date | null) => {
    if (!time) return;
    
    const newDate = selected ? new Date(selected) : new Date();
    newDate.setHours(time.getHours(), time.getMinutes(), 0, 0);
    onChange(newDate);
  };

  // Filter times to exclude past times if on the min date
  const filterTime = (time: Date) => {
    if (!minDate) return true;
    const checkDate = selected || new Date();
    // If same day as minDate, filter out past times
    if (checkDate.toDateString() === minDate.toDateString()) {
      return time.getTime() >= minDate.getTime();
    }
    return true;
  };

  return (
    <>
      <style jsx global>{`
        .react-datepicker {
          font-family: inherit;
          background-color: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 0.375rem;
          color: var(--foreground);
          font-size: 0.875rem;
        }

        .react-datepicker__header {
          background-color: var(--background-alt);
          border-bottom: 1px solid var(--card-border);
          padding-top: 0.75rem;
        }

        .react-datepicker__current-month,
        .react-datepicker-time__header {
          color: var(--foreground);
          font-weight: 500;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
        }

        .react-datepicker__day-names {
          margin-top: 0.5rem;
        }

        .react-datepicker__day-name {
          color: var(--muted);
          font-size: 0.75rem;
          width: 2rem;
          line-height: 2rem;
          margin: 0.1rem;
        }

        .react-datepicker__day {
          color: var(--foreground);
          width: 2rem;
          line-height: 2rem;
          margin: 0.1rem;
          border-radius: 0.25rem;
        }

        .react-datepicker__day:hover {
          background-color: var(--accent);
          color: black;
        }

        .react-datepicker__day--selected,
        .react-datepicker__day--keyboard-selected {
          background-color: var(--accent) !important;
          color: black !important;
        }

        .react-datepicker__day--today {
          font-weight: bold;
          border: 1px solid var(--accent);
        }

        .react-datepicker__day--disabled {
          color: var(--muted) !important;
          opacity: 0.5;
        }

        .react-datepicker__day--disabled:hover {
          background-color: transparent;
          color: var(--muted) !important;
        }

        .react-datepicker__day--outside-month {
          color: var(--muted);
          opacity: 0.5;
        }

        .react-datepicker__navigation {
          top: 0.75rem;
        }

        .react-datepicker__navigation-icon::before {
          border-color: var(--muted);
        }

        .react-datepicker__navigation:hover *::before {
          border-color: var(--foreground);
        }

        .react-datepicker__time-container {
          border-left: none;
        }

        .react-datepicker__time {
          background-color: var(--card);
        }

        .react-datepicker__time-box {
          width: 100px !important;
        }

        .react-datepicker__time-list {
          height: 200px !important;
        }

        .react-datepicker__time-list-item {
          color: var(--foreground);
          padding: 0.5rem 1rem !important;
        }

        .react-datepicker__time-list-item:hover {
          background-color: var(--accent) !important;
          color: black !important;
        }

        .react-datepicker__time-list-item--selected {
          background-color: var(--accent) !important;
          color: black !important;
        }

        .react-datepicker__time-list-item--disabled {
          color: var(--muted) !important;
          opacity: 0.5;
        }

        .react-datepicker__triangle {
          display: none;
        }

        .react-datepicker-popper {
          z-index: 100;
        }

        .react-datepicker__month-container {
          float: none;
        }

        .react-datepicker__month {
          margin: 0.5rem;
        }

        .react-datepicker__week {
          display: flex;
        }

        /* Time-only picker styling */
        .react-datepicker--time-only {
          background-color: var(--card);
          border: 1px solid var(--card-border);
        }

        .react-datepicker--time-only .react-datepicker__time-container {
          border-left: none;
          background-color: var(--card);
        }

        .react-datepicker--time-only .react-datepicker__time {
          background-color: var(--card);
          border-radius: 0.375rem;
        }

        .react-datepicker--time-only .react-datepicker__time-box {
          background-color: var(--card);
        }

        .react-datepicker--time-only .react-datepicker__header--time {
          background-color: var(--background-alt);
          border-bottom: 1px solid var(--card-border);
        }

        .react-datepicker--time-only .react-datepicker-time__header {
          color: var(--foreground);
        }

        .react-datepicker--time-only .react-datepicker__time-list {
          background-color: var(--card);
        }

        .react-datepicker--time-only .react-datepicker__time-list-item {
          background-color: var(--card);
          color: var(--foreground);
        }

        .react-datepicker--time-only .react-datepicker__time-list-item:hover {
          background-color: var(--accent) !important;
          color: black !important;
        }
      `}</style>
      <div className="flex gap-0.5">
        {/* Date Picker */}
        <div className="flex-1">
          <DatePicker
            selected={selected}
            onChange={handleDateChange}
            dateFormat="MMM d, yyyy"
            minDate={minDate || new Date()}
            customInput={<DateInput placeholder="Select date..." />}
            popperPlacement="bottom-start"
            showPopperArrow={false}
          />
        </div>
        
        {/* Time Picker */}
        <div className="flex-1">
          <DatePicker
            selected={selected}
            onChange={handleTimeChange}
            showTimeSelect
            showTimeSelectOnly
            timeFormat="h:mm aa"
            timeIntervals={15}
            dateFormat="h:mm aa"
            customInput={<TimeInput placeholder="Select time..." />}
            popperPlacement="bottom-start"
            showPopperArrow={false}
            filterTime={filterTime}
          />
        </div>
      </div>
    </>
  );
}

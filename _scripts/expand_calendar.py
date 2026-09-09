#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["icalendar", "python-dateutil"]
# ///
"""
_scripts/expand_calendar.py -- the Upcoming widget's data, derived.

Reads the committed calendar at _calendar/office-availability.ics, expands
every recurrence rule in it, and writes the next few occurrences to
_data/calendar.json for _includes/upcoming.html to render.

WHY THIS EXISTS AT ALL. Every live event on the source calendar is a
recurrence rule, so a build that read DTSTART without expanding would show
one stale event from October 2025 and nothing else. Expansion is not a
refinement of this widget; it is the widget.

WHY IT RUNS AT BUILD AND NOT IN THE READER'S BROWSER. Nothing here reaches
the network and nothing ships to the reader: S-01 (every request
same-origin) is untouched by design rather than by exemption. The calendar
is a committed file on the brewfile precedent (RULED 2026-09-06), so the
repository copy is the source of record and a re-export is a commit.

WHY THE DEPENDENCIES ARE NAMED HERE AND NOT IN THE WORKFLOW. The manifest
above is read by uv on both this machine and the Actions runner, so the two
runtimes cannot drift; the committed .lock beside this file pins the
versions, exactly as Gemfile.lock does for the Jekyll build. One
declaration, two consumers -- the same argument that made listening.html a
single include rather than three copies of one rule.

Run it with `uv run _scripts/expand_calendar.py`, or `--dry-run` to print
the selection without writing the data file.
"""

from __future__ import annotations

import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from dateutil.rrule import rrulestr, rruleset
from icalendar import Calendar

REPO = Path(__file__).resolve().parent.parent
ICS = REPO / "_calendar" / "office-availability.ics"
OUT = REPO / "_data" / "calendar.json"

# The calendar is authored in Pacific time and read by a reader who is
# overwhelmingly in Pullman. "Now" is anchored here rather than in the
# runner's UTC, which would bucket a 10am Pacific class into the wrong day
# for seven hours of every day.
LOCAL = ZoneInfo("America/Los_Angeles")

# How many occurrences to write. The include slices this to five in an
# aside and one in the sign-off, so this number is headroom: changing what
# a page shows must not require touching this script.
EMIT = 10

# How far ahead to expand. A rule carrying UNTIL stops on its own; an
# unbounded weekly rule would expand forever without a horizon.
HORIZON = timedelta(days=400)

# How far back the expansion window opens. Not zero: an event that started
# before now and has not finished is still the reader's next thing, and the
# end-based filter below keeps it. Two days covers a multi-day event in
# progress.
LOOKBACK = timedelta(days=2)


def as_local(value):
    """Normalise a VEVENT date-or-datetime to (aware datetime, all_day).

    icalendar returns a `date` for an all-day event and a `datetime`
    otherwise, and a datetime may be naive where the calendar wrote a
    floating time. Both cases occur in exported Apple calendars, so neither
    is assumed away.
    """
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=LOCAL), False
        return value.astimezone(LOCAL), False
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=LOCAL), True
    raise TypeError(f"expand_calendar: unhandled date type {type(value)!r}")


def date_list(component, key):
    """EXDATE and RDATE, which iCalendar allows to repeat as properties and
    to carry several values each. icalendar hands back one object or a list
    depending on which; both shapes are handled rather than guessed at."""
    prop = component.get(key)
    if prop is None:
        return []
    props = prop if isinstance(prop, list) else [prop]
    return [as_local(d.dt)[0] for p in props for d in p.dts]


def duration_of(component, start, all_day):
    """DTEND if present, DURATION if not, and a day for a bare all-day
    event, which iCalendar permits to carry neither."""
    end = component.get("DTEND")
    if end is not None:
        return as_local(end.dt)[0] - start
    dur = component.get("DURATION")
    if dur is not None:
        return dur.dt
    return timedelta(days=1) if all_day else timedelta(0)


def occurrences(master, window_start, window_end):
    """Every start this component produces inside the window."""
    start, _ = as_local(master["DTSTART"].dt)
    rule = master.get("RRULE")
    if rule is None:
        return [start] if window_start <= start <= window_end else []
    rules = rruleset()
    rules.rrule(rrulestr(rule.to_ical().decode(), dtstart=start))
    for excluded in date_list(master, "EXDATE"):
        rules.exdate(excluded)
    for added in date_list(master, "RDATE"):
        rules.rdate(added)
    return list(rules.between(window_start, window_end, inc=True))


def clock(moment):
    return f"{moment.hour % 12 or 12}:{moment.minute:02d}"


def meridiem(moment):
    return "am" if moment.hour < 12 else "pm"


def render_time(start, end, all_day):
    """The rendered span. Empty for an all-day event, which the include
    renders as a day carrying no time rather than as a zero-length one. The
    meridiem is written once where both ends share it -- 10:00-11:00 am --
    and twice where they do not."""
    if all_day:
        return ""
    if meridiem(start) == meridiem(end):
        return f"{clock(start)}\u2013{clock(end)} {meridiem(start)}"
    return (f"{clock(start)} {meridiem(start)}"
            f"\u2013{clock(end)} {meridiem(end)}")


def render_day(moment):
    return f"{moment:%a} {moment.day} {moment:%b}"


def collect(calendar, now):
    """Masters expanded, overrides substituted, cancellations dropped."""
    masters, overrides = [], {}
    for component in calendar.walk("VEVENT"):
        if component.get("RECURRENCE-ID") is not None:
            uid = str(component.get("UID"))
            overrides[(uid, as_local(component["RECURRENCE-ID"].dt)[0])] = component
        else:
            masters.append(component)

    window_start, window_end = now - LOOKBACK, now + HORIZON
    found = []
    for master in masters:
        uid = str(master.get("UID"))
        base, base_all_day = as_local(master["DTSTART"].dt)
        base_duration = duration_of(master, base, base_all_day)
        for start in occurrences(master, window_start, window_end):
            # A RECURRENCE-ID component replaces the instance it names: its
            # own DTSTART, duration and summary win, and it may move the
            # occurrence anywhere. An instance you deleted in Calendar
            # arrives either as an EXDATE, handled above, or as an override
            # carrying STATUS:CANCELLED, handled here.
            instance = overrides.get((uid, start), master)
            if str(instance.get("STATUS", "")).upper() == "CANCELLED":
                continue
            if instance is master:
                all_day, duration = base_all_day, base_duration
            else:
                start, all_day = as_local(instance["DTSTART"].dt)
                duration = duration_of(instance, start, all_day)
            summary = str(instance.get("SUMMARY", "")).strip()
            end = start + duration
            # End rather than start: an office hour in progress is still
            # the reader's next thing, and dropping it the minute it begins
            # would be worse than showing it while it runs.
            if end <= now or not summary:
                continue
            found.append((start, end, all_day, summary))

    # Deduplicate before sorting: an override moved onto a date its own
    # rule already produces would otherwise appear twice.
    return sorted(set(found), key=lambda item: item[0])


def main():
    dry_run = "--dry-run" in sys.argv
    if not ICS.exists():
        sys.exit(f"expand_calendar: no calendar at {ICS}")

    now = datetime.now(LOCAL)
    upcoming = collect(Calendar.from_ical(ICS.read_bytes()), now)

    # No assertion that this is non-empty, deliberately. Every rule on the
    # source calendar carries an UNTIL in December; once they expire, an
    # empty widget reading "Nothing scheduled" is the truth rather than a
    # fault, and a script that aborted on it would break the build for
    # telling it.
    payload = {
        "_comment": ("GENERATED by _scripts/expand_calendar.py from "
                     "_calendar/office-availability.ics. Do not edit by "
                     "hand: the workflow overwrites it above the Jekyll "
                     "build. Schema is the contract stated in "
                     "_includes/upcoming.html."),
        "generated": now.isoformat(timespec="seconds"),
        "events": [
            {"day": render_day(start),
             "time": render_time(start, end, all_day),
             "summary": summary}
            for start, end, all_day, summary in upcoming[:EMIT]
        ],
    }

    print(f"expand_calendar: now = {now.isoformat(timespec='seconds')}")
    print(f"expand_calendar: {len(upcoming)} upcoming in window, "
          f"writing {len(payload['events'])}")
    for event in payload["events"]:
        print(f"  {event['day']:<12} {event['time']:<20} {event['summary']}")

    if dry_run:
        print("expand_calendar: --dry-run, nothing written")
        return
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
                   encoding="utf-8")
    print(f"expand_calendar: wrote {OUT}")


if __name__ == "__main__":
    main()

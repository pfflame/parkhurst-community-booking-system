# Parkhurst Community Booking System - Technical Design

## Project Overview

An automated facility booking tool built with Node.js and Puppeteer. It drives the
Skedda/AllBooked booking platform from the command line so recurring court bookings can run
unattended from a scheduler (Qinglong cron).

## System Architecture

### Core Components

1. **CLI Interface** (`index.js`)
   - Command parsing with Commander.js
   - Date calculation (`--date` or `--book-in-advance`)
   - Facility fallback loop and pre-submit retry
   - Success/failure notification dispatch

2. **Booking Engine** (`src/booking.js`)
   - Puppeteer browser lifecycle
   - Login, form filling, multi-strategy button detection
   - Modal dialog handling
   - Polling-based success verification

3. **Alert Classification** (`src/booking-messages.js`)
   - Scores visible page alerts as failure / confirmation / informational
   - Pure functions, no browser dependency

4. **Completed-URL Detection** (`src/booking-url.js`)
   - Recognises the post-booking URL across tenant hostname migrations
     (`skedda.com` → `allbooked.com`)

5. **Configuration** (`src/config.js`)
   - Config file loading and validation
   - Explicit two-field email/password files, separate from shared booking settings

6. **Utilities** (`src/utils.js`)
   - Booking title formatting, URL generation, timestamped logging

7. **Notifications** (`index.js` + external `sendNotify.js`)
   - **Lazy loading**: the Qinglong `sendNotify.js` in the parent directory is required *after*
     argument parsing, so `--notify-email` can set `process.env.SMTP_TO` first. This allows
     per-job recipients without changing global Qinglong settings.
   - Absent outside Qinglong, in which case the tool runs without notifications.

### File Structure

```
src/
├── booking.js           # Automation and verification
├── booking-messages.js  # Alert classification
├── booking-url.js       # Completed-booking URL detection
├── config.js            # Configuration and credentials
└── utils.js             # Helpers, logging

test/
├── booking.test.js      # Pure logic (URL + alert classification)
└── verify.test.js       # Verification loop against a stubbed page

config/
├── config.json          # User configuration (gitignored)
└── config.example.json  # Template

config/credentials.example.json  # Two-field user template
config/users/            # Private account files (Git-ignored)
index.js                 # CLI entry point
booking_errors.log       # Runtime log (gitignored)
```

## URL Format

Skedda uses parameterized URLs to open a pre-filled booking form:

```
https://parkhurst.skedda.com/booking?nbend=2026-08-21T17%3A00%3A00&nbspaces=1244466&nbstart=2026-08-21T16%3A00%3A00
```

- `nbstart` / `nbend`: start and end datetimes, ISO format, URL encoded
- `nbspaces`: facility/space ID

These parameters disappear once a booking completes, which is the primary success signal.

## Booking Workflow

### 1. Initialization
- Launch Chromium — the system binary at `/usr/bin/chromium` when present (Docker), otherwise
  Puppeteer's bundled build (local development)
- Set a 1280x720 viewport

### 2. Navigation and Authentication
- Navigate to the generated booking URL
- If a booking form is already present, skip login
- Otherwise fill email/password and submit, then wait for navigation

### 3. Form Filling
- **Title**: defaults to `{start - buffer} - {end + buffer}` (e.g. 16:00–17:00 with a 15 minute
  buffer becomes "3:45PM - 5:15PM"); `--title` overrides it
- **Field detection**: several candidate selectors are tried for both title and signature
- A missing **title** field throws before submission rather than creating a blank-titled booking.
  A missing **signature** field only warns, since it may legitimately be optional.

### 4. Submission
- Priority-ordered button selectors, most specific first
  (`.row.pt-5 .col-12 button.btn.btn-success`), falling back to matching button text
  ("Confirm" / "Book" / "Submit")
- Standard Puppeteer click, with a JavaScript click as fallback
- Post-submission modal dialogs are detected and confirmed

### 5. Verification

After a short settle delay, the page is polled (default every 500ms up to 20s, configurable via
`defaults.verifySettleMs` / `verifyPollIntervalMs` / `verifyTimeoutMs`) and stops at the first
terminal signal.

Polling matters because the confirmation banner is a transient toast. Sampling once at a fixed
offset is wrong in both directions: it can catch a toast that should be ignored, and it can miss a
redirect that lands moments later.

Checks, in order:

1. **Failure** if a visible alert matches a known failure keyword, or is rendered in a
   danger-styled element.
2. **Success** if a confirmation banner is visible ("Too easy - your booking is confirmed.").
3. **Success** if the URL is the base booking URL with the `nb*` parameters gone.
4. **Failure** on timeout, listing every alert seen across all polls.

The confirmation banner and failure banners share the same `[role="alert"]` markup, so an
*unrecognised* alert is never treated as a failure on its own — check 3 decides. A recognised
confirmation is never treated as a failure even inside a danger-styled wrapper.

**Quota rejections are real failures.** "This booking cannot be confirmed because it would mean
that your quota is exceeded…" means the per-person daily hour limit across the tennis and
basketball spaces is already used up for that date, so the booking genuinely did not happen. It is
reported as a failure, and the fallback list does not treat it specially.

### 6. Cleanup
- The browser is closed in a `finally` block
- Errors, including current URL and page title, are logged to `booking_errors.log`

## Facility Fallback and Retry

`--facility` accepts a comma-separated list. Each is attempted in order and the loop stops at the
first success, so a fallback court is only attempted when the preceding one genuinely failed.

Each facility gets **one retry**, but only for errors raised *before* the Confirm click — those
lacking `bookingErrorMessage`. Every error from `createBookingError` carries that field, covering
everything after submission including the verification timeout, so a retry can never duplicate a
booking that may already exist.

## Configuration Schema

```json
{
  "defaults": {
    "signature": "ZZ",
    "bufferMinutes": 15,
    "headless": true,
    "bookInAdvanceDays": 14,
    "timeout": 30000,
    "verifySettleMs": 2000,
    "verifyPollIntervalMs": 500,
    "verifyTimeoutMs": 20000
  },
  "facilities": {
    "tennis_lower": { "spaceId": "1244466", "name": "Tennis - Lower Court Whole" },
    "tennis_upper": { "spaceId": "1244467", "name": "Tennis - Upper Court Whole" }
  },
  "urls": {
    "baseUrl": "https://parkhurst.skedda.com/booking",
    "loginUrl": "https://parkhurst.skedda.com/login"
  }
}
```

Tasks explicitly select a two-field email/password file with `--credentials`.
Shared configuration contains only booking settings. The project does not load
an environment file or infer an account from environment variables. `list` and
configuration-only `validate` work without credentials; booking requires a login.

## CLI Command Structure

### `book`

**Required:**
- `--facility <facility_ids>`: facility key(s) from config; comma-separated enables fallback
- `--start-time <time>` / `--end-time <time>`: HH:MM

**Date selection** (optional; defaults to `defaults.bookInAdvanceDays`, or 14):
- `--date <date>`: YYYY-MM-DD. Mutually exclusive with `--book-in-advance`.
- `--book-in-advance [days]`: days ahead of today.

**Optional:**
- `--notify-email <email>`: overrides `SMTP_TO` for this run; comma-separated for several recipients
- `--credentials <path>`: private JSON containing only email and password
- `--email <email>` and `--password <password>`: optional direct login pair (mutually exclusive with `--credentials`)
- `--signature <signature>` / `--title <title>`: override config defaults
- `--headless <boolean>`: default true
- `--config <path>`: custom config file
- `--force-date`: allow dates in the past

### `list` / `validate` / `examples`
List configured facilities, validate the config file, and print usage examples.

## Error Handling

1. **Input validation** — date format and not-in-the-past (unless `--force-date`), time format and
   ordering, facility existence.
2. **Infrastructure failures** — browser launch, navigation timeouts, element detection. These
   occur before submission and are retried once.
3. **Booking rejections** — quota exceeded, conflicts, and other site-reported errors. Final; never
   retried.
4. **Logging** — every run appends to `booking_errors.log` with timestamps. Set
   `BOOKING_DISABLE_FILE_LOG=1` to suppress file logging (used by the tests so fixture output does
   not read like real booking activity).

## Security Considerations

- Credentials live only in the selected `config/users/*.json` file, excluded from version control and owner-readable on the NAS
- Credentials are never written to logs or notifications
- Chromium runs with `--no-sandbox` in Docker, which is required for the container runtime; the
  browser loads only the booking site and keeps no persistent profile

## Dependencies

- **puppeteer**: browser automation
- **commander**: CLI argument parsing
- **moment**: date/time formatting and validation
- **chalk**: coloured console output (optional at runtime; a no-op proxy is used if unavailable)

## Testing

`npm test` runs:

- `test/booking.test.js` — pure functions: completed-URL detection and alert classification,
  including the confirmation-vs-quota cases taken verbatim from production logs
- `test/verify.test.js` — the verification loop against a stubbed page: late-appearing toast, late
  redirect, confirmation inside a danger wrapper, quota rejection, timeout reporting, and the
  retryable/non-retryable error contract
- `node index.js validate` and `node index.js list` as a config smoke test

## Possible Future Work

- Check existing bookings before attempting, to skip work that would hit the quota
- Direct API calls if Skedda exposes them, removing the browser dependency
- Log rotation for `booking_errors.log`

Direct `--email` and `--password` must both be nonempty; no partial fallback to other accounts is allowed. The `validate` command supports the same pair without making network requests.

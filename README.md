# Parkhurst Community Booking System

An automated facility booking system for Parkhurst HOA using Node.js and Puppeteer.

## Features

- **Automated Login & Booking**: Handles credential management and facility reservations.
- **Smart Logic**: Auto-calculates booking titles and handles buffer times.
- **Robustness**: Enhanced button detection, modal handling, and visual debug mode.
- **Resilient verification**: Polls for a confirmation banner or completed URL rather than sampling once, and retries pre-submit failures.
- **Secure**: User credentials live in private, Git-ignored two-field files.
- **Notifications**: Integrated with Qinglong specific notification logic.

> [!NOTE]
> For detailed technical architecture, internal logic, and design decisions, please refer to [DESIGN.md](DESIGN.md).

## Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd parkhurst-community-booking-system
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3. **Create the shared booking configuration**:
   ```bash
   cp config/config.example.json config/config.json
   ```
   Create a credentials file with the two fields shown below.

## Usage

### Commands

**Required Parameters:**
- `--facility <facility_ids>` - Facility ID to book (e.g., tennis_lower). **Supports fallback:** Provide multiple comma-separated IDs (e.g., `tennis_lower,tennis_upper`). If the first one fails, it tries the next.
- `--start-time <time>` - Start time (HH:MM)
- `--end-time <time>` - End time (HH:MM)

**Date Selection** (optional; defaults to `defaults.bookInAdvanceDays` in config, or 14):
- `--date <date>` - Booking date (YYYY-MM-DD). Mutually exclusive with `--book-in-advance`.
- `--book-in-advance [days]` - Number of days in advance to book (e.g., `14` for 14 days from today). If no value is provided, defaults to config value or 14. Mutually exclusive with `--date`.

**Login (choose one):**
- `--credentials <path>` - JSON file containing only `email` and `password` (recommended).
- `--email <email>` and `--password <password>` - Direct credential pair.

**Optional Parameters:**
- `--notify-email <email>` - Override general notification recipient. Support multiple recipients by separating with commas (e.g., `"user1@test.com, user2@test.com"`).
- `--signature <signature>` - Custom signature.
- `--title <title>` - Custom booking title.
- `--headless <boolean>` - Run in headless mode (default: true).
- `--config <path>` - Custom config file path.
- `--force-date` - Allow booking dates in the past.

- **List facilities**:
  ```bash
  node index.js list
  ```

- **Validate config**:
  ```bash
  node index.js validate
  ```

- **See examples**:
  ```bash
  node index.js examples
  ```

### Multiple users: edit only email and password

Each user has a simple file such as `config/users/eric.json`:

```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

On this NAS, the user files are `config/users/eric.json`, `config/users/lara.json`,
`config/users/lizzy-1.json`, and `config/users/lizzy-2.json`. Eric’s two tasks share his file.
Edit only these two values to change the login; no profile variable names are needed.

The Qinglong task references the file:

```bash
task parkhurst-community-booking-system/index.js book --facility tennis_upper --book-in-advance --start-time 09:00 --end-time 10:00 --credentials config/users/eric.json
```

To add a user, copy `config/credentials.example.json` to `config/users/new-user.json`,
fill the email/password, and select that file in the user's task. File paths are
relative to the project root unless absolute. JSON escaping handles special characters;
passwords do not need shell quoting because they are not part of the command.
The account email is separate from `--notify-email` (notification recipients).

Check configuration without logging in, sending email, or booking:

```bash
node index.js validate --credentials config/users/eric.json
```

Credentials files are private local files and excluded from Git. On the NAS they have
owner-only permissions. Both fields must be nonempty; the loader never fills a missing
field using another account. `--credentials` cannot be combined with direct credentials.
The optional `--signature` setting is independent of login credentials.

Shared `config/config.json` contains only booking defaults, facility IDs, and URLs.
There are no login credentials in shared settings, no profile environment variables,
and no project `.env` file. Every booking explicitly selects its user. Running
`node index.js validate` without a user validates only the shared settings.

## Testing

```bash
npm test
```

Runs credential precedence and CLI tests (`test/config.test.js`),
the pure-logic tests (`test/booking.test.js`), the verification-loop tests
(`test/verify.test.js`), then validates the config and lists facilities.

## Troubleshooting

- **Login Failed**: Verify `email` and `password` in the task’s credentials file.
- **Booking Form Not Found**: Check if the facility is already booked or closed.
- **Quota exceeded**: A real failure — the daily per-person hour limit across all
  tennis/basketball spaces is already used up for that date.
- **Browser Issues**: Run with `--headless false` to visually debug the interaction.
- **Logs**: Check `booking_errors.log` for detailed failure information.

## License

MIT License - see LICENSE file for details.
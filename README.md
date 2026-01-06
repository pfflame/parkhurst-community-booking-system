# Parkhurst Community Booking System

An automated facility booking system for Parkhurst HOA using Node.js and Puppeteer.

## Features

- **Automated Login & Booking**: Handles credential management and facility reservations.
- **Smart Logic**: Auto-calculates booking titles and handles buffer times.
- **Robustness**: Enhanced button detection, modal handling, and visual debug mode.
- **Robustness**: Enhanced button detection, modal handling, and visual debug mode.
- **Secure**: Supports environment variables for credential protection.
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

3.  **Configure credentials**:
    
    **Option A (Recommended)**: Use environment variables.
    ```bash
    cp .env.example .env
    # Edit .env with your credentials
    ```

    **Option B**: Edit `config/config.json`.
    ```json
    {
      "credentials": {
        "email": "your-email@example.com",
        "password": "your-password"
      }
    }
    ```

## Usage

### Commands

- **Required Parameters:**
- `--facility <facility_ids>` - Facility ID to book (e.g., tennis_lower). **Supports fallback:** Provide multiple comma-separated IDs (e.g., `tennis_lower,tennis_upper`). If the first one fails, it tries the next.
- `--date <date>` - Booking date (YYYY-MM-DD). Mutually exclusive with `--book-in-advance`.
- `--book-in-advance [days]` - Number of days in advance to book (e.g., `14` for 14 days from today). If no value is provided, defaults to config value or 14. Mutually exclusive with `--date`.
- `--start-time <time>` - Start time (HH:MM)
- `--start-time <time>` - Start time (HH:MM)
- `--end-time <time>` - End time (HH:MM)

**Optional Parameters:**
- `--notify-email <email>` - Override general notification recipient for this specific job.
- `--profile <email_or_name>` - User profile for credentials.
- `--signature <signature>` - Custom signature.
- `--title <title>` - Custom booking title.
- `--headless <boolean>` - Run in headless mode (default: true).
- `--config <path>` - Custom config file path.
- `--force-date` - Allow booking dates in the past.
  ```

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

### Advanced Profile Configuration

The system supports multiple user profiles via environment variables.

**Format**: `PROFILE_{EMAIL_SANITIZED}_VAR`
(Replace `@` and `.` with `_` and uppercase the email)

Example for `john.doe@example.com`:
```bash
PROFILE_JOHN_DOE_EXAMPLE_COM_USERNAME=john.doe@example.com
PROFILE_JOHN_DOE_EXAMPLE_COM_PASSWORD=johns_password
PROFILE_JOHN_DOE_EXAMPLE_COM_SIGNATURE=JD
```

Usage: `node index.js book ... --profile "john.doe@example.com"`

## Troubleshooting

- **Login Failed**: Verify credentials in `.env` or `config.json`.
- **Booking Form Not Found**: Check if the facility is already booked or closed.
- **Browser Issues**: Run with `--headless false` to visually debug the interaction.
- **Logs**: Check `booking_errors.log` for detailed failure information.

## License

MIT License - see LICENSE file for details.
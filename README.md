# Parkhurst Community Booking System

An automated facility booking system for Parkhurst HOA using Node.js and Puppeteer.

## Features

- **Automated Login & Booking**: Handles credential management and facility reservations.
- **Smart Logic**: Auto-calculates booking titles and handles buffer times.
- **Robustness**: Enhanced button detection, modal handling, and visual debug mode.
- **Secure**: Supports environment variables for credential protection.

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

- **Book a facility**:
  ```bash
  node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00
  ```

- **Book in advance** (defaults to 14 days):
  ```bash
  node index.js book --facility tennis_lower --book-in-advance
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
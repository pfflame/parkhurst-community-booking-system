# Parkhurst Community Booking System

An automated facility booking system for Parkhurst HOA using Node.js and Puppeteer. This tool automates the process of logging into the Skedda booking system and making facility reservations.

## Features

- 🤖 **Automated Login**: Handles authentication with stored credentials
- 📅 **Smart Booking**: Automatically generates booking titles with buffer times
- 🏢 **Multiple Facilities**: Support for tennis courts and other community facilities
- ⚙️ **Configurable**: Easy configuration through JSON file or environment variables
- 🖥️ **CLI Interface**: Simple command-line interface with helpful examples
- 🔒 **Secure**: Supports environment variables for sensitive credentials
- 📸 **Debug Mode**: Visual browser mode for troubleshooting
- ✅ **Robust Error Handling**: Comprehensive error detection, URL-based success verification, and detailed logging to `booking_errors.log`
- 🎯 **Enhanced Button Detection**: Multiple selector strategies for reliable automation
- 🔄 **Modal Dialog Handling**: Automatic detection and interaction with confirmation dialogs

## Installation

### Prerequisites

- Node.js 16.0.0 or higher
- npm (comes with Node.js)

### Setup

1. **Clone or download the project**:
   ```bash
   git clone <repository-url>
   cd parkhurst-community-booking-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure your credentials**:
   
   **Option A**: Use environment variables (recommended for security):
   ```bash
   cp .env.example .env
   # Edit .env file with your actual credentials
   ```
   
   **Option B**: Edit `config/config.json` directly:
   ```json
   {
     "credentials": {
       "email": "your-email@example.com",
       "password": "your-password"
     }
   }
   ```

## Usage

### CLI Commands

#### `book` - Make a booking
```bash
node index.js book --facility <facility_id> --date <date> --start-time <start_time> --end-time <end_time> [options]
```

The script will attempt to book the specified facility. The date can be provided directly with `--date` or calculated using `--book-in-advance`.

**Required Parameters:**
- `--facility <facility_id>` - Facility ID to book (e.g., tennis_lower)
- `--date <date>` - Booking date (YYYY-MM-DD). Mutually exclusive with `--book-in-advance`.
- `--book-in-advance [days]` - Number of days in advance to book (e.g., `15` for 15 days from today). If no value is provided, defaults to config value or 15. Mutually exclusive with `--date`.
- `--start-time <time>` - Start time (HH:MM)
- `--end-time <time>` - End time (HH:MM)

**Optional Parameters:**
- `--profile <email_or_name>` - User profile for credentials (email or name from config)
- `--signature <signature>` - Custom signature (overrides config)
- `--title <title>` - Custom booking title (overrides auto-generation)
- `--headless <boolean>` - Run in headless mode (default: true)
- `--config <path>` - Custom config file path
- `--force-date` - (Optional) Allow using `--date` even if it specifies a past date. Useful for testing. Use with caution.


#### `list` - List available facilities
```bash
node index.js list
```

#### `validate` - Validate configuration
```bash
node index.js validate
```

#### `examples` - Show usage examples
```bash
node index.js examples
```

### Basic Booking Examples

```bash
# Book for a specific date
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00

# Book 15 days in advance (using default from config)
node index.js book --facility tennis_lower --book-in-advance --start-time 12:00 --end-time 13:00

# Book 10 days in advance
node index.js book --facility tennis_lower --book-in-advance 10 --start-time 12:00 --end-time 13:00

# Book with different profile (email or name)
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --profile "john.doe@example.com"

# Book with custom signature
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --signature "JD"

# Book with both profile and signature
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --profile "jane.smith@example.com" --signature "JS"

# Book with custom title
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --title "Tennis Practice"

# Complete example with ALL parameters
node index.js book --facility tennis_upper --date 2025-06-15 --start-time 12:00 --end-time 13:00 --profile "jane.smith@company.org" --signature "JS" --title "Tournament Practice" --headless false --config "/path/to/custom/config.json"
```

### Booking in Advance

If `--book-in-advance` is used without a value, the script will use the default number of days specified in `config.json` (in `defaults.bookInAdvanceDays`, which is 15 by default in the example configuration). If this default is not found in the configuration, it will fall back to a hardcoded 15 days.

```bash
# Use default advance booking days from config
node index.js book --facility tennis_lower --book-in-advance --start-time 10:00 --end-time 11:00

# Book specific number of days in advance
node index.js book --facility tennis_lower --book-in-advance 10 --start-time 10:00 --end-time 11:00
```

### Advanced Usage

#### Profile-based Booking
The system supports multiple user profiles stored in environment variables. Each profile requires a password and can optionally have a signature.

Use the `--profile` parameter to book with different email addresses without changing your config file:
```bash
# Book for a family member
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --profile "spouse@example.com"

# Book for a friend (if authorized)
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --profile "friend@example.com" --signature "FR"
```

**Setting up profiles in .env:**
```bash
# For john.doe@example.com (@ and . become _)
PROFILE_JOHN_DOE_EXAMPLE_COM_USERNAME=john.doe@example.com
PROFILE_JOHN_DOE_EXAMPLE_COM_PASSWORD=johns_password
PROFILE_JOHN_DOE_EXAMPLE_COM_SIGNATURE=JD

# For jane.smith@company.org
PROFILE_JANE_SMITH_COMPANY_ORG_USERNAME=jane.smith@company.org
PROFILE_JANE_SMITH_COMPANY_ORG_PASSWORD=janes_password
PROFILE_JANE_SMITH_COMPANY_ORG_SIGNATURE=JS
```

#### Debug Mode (Non-headless)
```bash
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --headless false
```

#### Custom Config File
```bash
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --config /path/to/config.json
```

## Configuration

### Config File Structure

```json
{
  "credentials": {
    "email": "your-email@example.com",
    "password": "your-password"
  },
  "defaults": {
    "signature": "ZZ",
    "bufferMinutes": 15,
    "headless": true,
    "timeout": 30000
  },
  "facilities": {
    "tennis_lower": {
      "spaceId": "1244466",
      "name": "Tennis - Lower Court Whole"
    },
    "tennis_upper": {
      "spaceId": "1244467",
      "name": "Tennis - Upper Court Whole"
    }
  },
  "urls": {
    "baseUrl": "https://parkhurst.skedda.com/booking",
    "loginUrl": "https://parkhurst.skedda.com/login"
  }
}
```

### Environment Variables

See `.env.example` for all available environment variables:

#### Default Profile
- `BOOKING_EMAIL`: Your login email (required)
- `BOOKING_PASSWORD`: Your login password (required)
- `BOOKING_SIGNATURE`: Default signature for bookings (optional)

#### Multiple Profiles
For multiple users, add profile-specific environment variables:
```bash
# Convert email to environment variable format:
# Replace @ and . with _ and convert to uppercase
# john.doe@example.com becomes JOHN_DOE_EXAMPLE_COM

PROFILE_JOHN_DOE_EXAMPLE_COM_USERNAME=john.doe@example.com
PROFILE_JOHN_DOE_EXAMPLE_COM_PASSWORD=johns_password
PROFILE_JOHN_DOE_EXAMPLE_COM_SIGNATURE=JD

PROFILE_JANE_SMITH_COMPANY_ORG_USERNAME=jane.smith@company.org
PROFILE_JANE_SMITH_COMPANY_ORG_PASSWORD=janes_password
PROFILE_JANE_SMITH_COMPANY_ORG_SIGNATURE=JS
```

Environment variables take precedence over `config.json` settings. Use `--profile email@domain.com` to select a specific profile.

## URL Format Explanation

The Skedda booking system uses URLs with specific parameters:

```
https://parkhurst.skedda.com/booking?nbend=2025-06-15T13%3A00%3A00&nbspaces=1244466&nbstart=2025-06-15T12%3A00%3A00
```

### URL Parameters:
- `nbend`: Booking end time in ISO format (2025-06-15T13:00:00)
- `nbspaces`: Facility/space ID (1244466 for tennis lower court)
- `nbstart`: Booking start time in ISO format (2025-06-15T12:00:00)

## Booking Title Format

The system automatically generates booking titles with buffer time:

- **Input**: Start time 12:00PM, End time 1:00PM
- **Generated Title**: "11:45AM - 1:15PM"
- **Logic**: Subtracts 15 minutes from start, adds 15 minutes to end

This helps ensure you have adequate setup and cleanup time for your booking.

## Available Facilities

The default configuration includes:

- `tennis_lower`: Tennis - Lower Court Whole
- `tennis_upper`: Tennis - Upper Court Whole

To add more facilities, update the `facilities` section in your config file with the appropriate `spaceId` values. Use the `list` command to see all configured facilities.

## Project Structure

```
parkhurst-community-booking-system/
├── src/
│   ├── booking.js          # Main Puppeteer automation engine
│   ├── utils.js            # Utility functions for formatting and validation
│   └── config.js           # Configuration management and validation
├── config/
│   └── config.json         # User credentials and settings
├── index.js                # CLI entry point and command handling
├── package.json            # Dependencies and scripts
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── README.md              # This file
└── DESIGN.md              # Technical design documentation
```

## Troubleshooting

### Common Issues

1. **Login Failed**
   - Verify your email and password in the config
   - Check if your account is approved for the venue
   - Try running in non-headless mode to see the login process

2. **Booking Form Not Found**
   - The facility might already be booked
   - Check if the date/time is valid
   - Verify the facility configuration

3. **Button Click Issues**
   - The system uses multiple button selection strategies
   - Try running in debug mode to see the browser interaction
   - Check for modal dialogs that might be blocking the process

4. **Browser Launch Failed**
   - Install required dependencies: `npm install`
   - On Linux, you might need additional packages for Puppeteer

### Debug Mode

Run with `--headless false` to see the browser in action:
```bash
node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --headless false
```

### Error Handling

The system provides comprehensive error logging with detailed information about failures. 
- Success is determined by redirection to the exact `https://parkhurst.skedda.com/booking` URL.
- If not redirected, or if specific error messages are found on the page, the booking is considered failed.
- All errors, including page URL and title at the time of failure, are logged to `booking_errors.log` in the project root.

### Logs

The system provides detailed logging with timestamps:
```
[2025-01-15 10:30:00] [INFO] Initializing browser...
[2025-01-15 10:30:02] [INFO] Browser initialized successfully
[2025-01-15 10:30:03] [INFO] Navigating to: https://parkhurst.skedda.com/booking?...
```

## Security Best Practices

1. **Use Environment Variables**: Store credentials in environment variables instead of config files
2. **Protect Config Files**: Add `config/config.json` to `.gitignore`
3. **Regular Updates**: Keep dependencies updated with `npm update`
4. **Limited Permissions**: Run with minimal required permissions

## Technical Features

- **Enhanced Button Detection**: Multiple selector strategies for reliable button clicking
- **Modal Dialog Handling**: Automatic detection and interaction with confirmation dialogs
- **Robust Error Detection**: URL-based success verification (exact match to base booking URL) and detailed error message scraping. Failures and errors are logged to `booking_errors.log`.
- **Smart Form Filling**: Multiple selector strategies for form fields
- **Retry Mechanisms**: Multiple click methods for improved reliability
- **Clean Architecture**: Modular design with separation of concerns
- **Comprehensive Logging**: Detailed timestamped logs for debugging
- **Environment Variable Support**: Secure credential management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Run in debug mode to see what's happening
3. Check the logs for error messages
4. Create an issue with detailed information

---

**Note**: This tool is designed specifically for Parkhurst HOA's Skedda booking system. It may need modifications for other venues or booking systems.
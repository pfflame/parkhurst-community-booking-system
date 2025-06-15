# Parkhurst Community Booking System - Technical Design

## Project Overview

The Parkhurst Community Booking System is an automated facility booking solution built with Node.js and Puppeteer. It provides a command-line interface for residents to book community facilities through the Skedda booking platform without manual browser interaction.

### Key Objectives
- Automate the tedious process of facility booking
- Provide a reliable, error-resistant booking system with enhanced button detection
- Offer flexible configuration options for different use cases
- Maintain security best practices for credential handling
- Handle dynamic web elements and modal dialogs effectively

## System Architecture

### Core Components

1. **CLI Interface** (`index.js`)
   - Command parsing and validation using Commander.js
   - User interaction and feedback with colored output
   - Comprehensive error handling and reporting

2. **Booking Engine** (`src/booking.js`)
   - Puppeteer browser automation with enhanced selectors
   - Multi-strategy button detection and clicking
   - Modal dialog handling and confirmation
   - Login and form filling with fallback mechanisms
   - Success/failure verification with multiple indicators

3. **Configuration Management** (`src/config.js`)
   - Config file loading and validation
   - Environment variable support with .env integration
   - Facility management and listing
   - Sample configuration generation

4. **Utilities** (`src/utils.js`)
   - Date/time formatting and validation
   - URL generation with proper encoding
   - Logging utilities with timestamps
   - Input validation helpers

### File Structure

```
src/
├── booking.js      # Main automation logic with enhanced selectors
├── config.js       # Configuration handling with env support
└── utils.js        # Helper functions and validation

config/
└── config.json     # User configuration

.env.example       # Environment variables template
index.js           # CLI entry point with Commander.js
package.json       # Dependencies and scripts
README.md         # User documentation
DESIGN.md         # Technical design (this file)
.gitignore        # Git ignore rules
```

## URL Format Analysis

The Skedda booking system uses parameterized URLs for direct booking access:

```
https://parkhurst.skedda.com/booking?nbend=2025-06-15T13%3A00%3A00&nbspaces=1244466&nbstart=2025-06-15T12%3A00%3A00
```

### URL Parameters:
- `nbend`: Booking end time in ISO format (URL encoded)
- `nbspaces`: Facility/space ID (unique identifier)
- `nbstart`: Booking start time in ISO format (URL encoded)

### URL Generation Process:
1. Convert date and time to ISO format (`YYYY-MM-DDTHH:mm:ss`)
2. URL encode the datetime strings
3. Construct URL with base URL and parameters
4. Navigate directly to pre-filled booking form

## Booking Workflow

### 1. Initialization
- Launch Puppeteer browser (headless or visible)
- Set viewport and user agent
- Configure timeouts and navigation settings

### 2. Navigation and Authentication
- Navigate to generated booking URL
- Check if already logged in (detect booking form)
- If not logged in, perform login sequence:
  - Wait for login form elements
  - Fill email and password from configuration
  - Submit login form
  - Wait for navigation to booking page

### 3. Form Filling
- **Booking Title Generation**:
  - Format: `{start_time-buffer}-{end_time+buffer}`
  - Example: 12:00PM-1:00PM → "11:45AM - 1:15PM"
  - Configurable buffer time (default: 15 minutes)

- **Form Field Detection**:
  - Multiple selector strategies for title field
  - Multiple selector strategies for signature field
  - Fallback selectors for different form layouts
  - Clear existing content before filling

### 4. Submission Process
- **Enhanced Button Detection**:
  - Priority-ordered selector list
  - Most specific selectors first (`.row.pt-5 .col-12 button.btn.btn-success`)
  - Generic selectors as fallbacks
  - Visibility and enabled state validation

- **Multiple Click Strategies**:
  - Standard Puppeteer click
  - JavaScript-based click as fallback
  - Event dispatching for stubborn elements
  - Focus and Enter key press

- **Post-Submission Handling**:
  - Modal dialog detection and interaction
  - Loading indicator monitoring
  - Success/error message detection
  - Page content analysis for confirmation

### 5. Verification and Cleanup
- **Success/Failure Determination**: 
  - Success is confirmed if the page URL is exactly `https://parkhurst.skedda.com/booking` after submission attempts.
  - Failure is determined if the URL does not match the success URL, or if specific error messages (e.g., from `.alert-danger`, `.error-message`) are detected on the page.
- **Error Logging**: 
  - Detailed error messages, including the current URL and page title at the time of failure, are logged to `booking_errors.log` in the project's root directory.
- **Browser Cleanup**: Puppeteer browser instance is closed.
- **Process Logging**: Detailed operational logs are maintained throughout the booking process via the `log` utility.

## Configuration Schema

```json
{
  "credentials": {
    "email": "user@example.com",
    "password": "password123"
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

## CLI Command Structure

### Main Commands

#### `book` - Primary booking command
**Required Parameters:**
- `-f, --facility <facility_id>`: Facility ID from configuration (e.g., tennis_lower)
- `-d, --date <date>`: Specifies the booking date in YYYY-MM-DD format. This is mutually exclusive with `--book-in-advance-days`.
- `--book-in-advance-days <days>`: An optional integer specifying how many days in the future the booking should be made. For example, `15` means 15 days from the current date. If this option is provided, `-d, --date` should not be used. If neither `-d, --date` nor `--book-in-advance-days` is specified, the script will use the default number of days specified in `config.json` (`defaults.bookInAdvanceDays`); if this is not set in the config, it defaults to 15 days in advance.
- `-s, --start <time>`: Start time (HH:MM)
- `-e, --end <time>`: End time (HH:MM)

**Optional Parameters:**
- `--profile <email_or_name>`: User profile for credentials (email or name from config)
- `--signature <signature>`: Custom signature (overrides config default)
- `--title <title>`: Custom booking title (overrides auto-generation)
- `--headless <boolean>`: Run in headless mode (default: true)
- `--config <path>`: Custom config file path
- `--force-date`: Allow booking dates in the past (for testing or specific scenarios)


#### `list` - Facility listing
- Displays all configured facilities
- Shows facility names and space IDs
- Validates configuration before listing

#### `validate` - Configuration validation
- Checks configuration file structure
- Validates required fields and formats
- Reports configuration status

#### `examples` - Usage examples
- Shows common usage patterns
- Provides copy-paste ready commands
- Includes debugging tips

### Usage Examples
```bash
# Basic booking
node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00

# With custom signature
node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00 --signature "JD"

# Debug mode (visible browser)
node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00 --headless false

# Custom title
node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00 --title "Tennis Practice"
```

## Error Handling Strategy

### 1. Input Validation
- Date (`YYYY-MM-DD`): Can be directly provided or calculated based on `book-in-advance-days`.
- Time format validation (HH:MM)
- Time range validation (start before end)
The `date` parameter (whether provided directly or calculated) is validated for the correct `YYYY-MM-DD` format. It's also checked to ensure it's not a past date, unless `--force-date` is used.
- Facility existence validation

### 2. Network and Browser Issues
- Browser launch failure handling
- Page load timeout management
- Network connectivity issues
- Element detection timeouts

### 3. Authentication Issues
- Login form detection
- Credential validation
- Authentication failure detection
- Session management

### 4. Booking Process Issues
- Form field detection failures
- Button click failures
- Modal dialog handling
- **Success/Failure Determination**: Verification is primarily based on the final URL. A successful booking redirects to the base booking URL (`https://parkhurst.skedda.com/booking`) without any query parameters. If the URL contains query parameters or if specific error messages are found on the page, the booking is considered failed. All errors are logged to `booking_errors.log`.

### 5. Recovery Mechanisms
- Multiple selector strategies
- Fallback click methods
- Comprehensive error logging for debugging
- Detailed error logging
- Graceful browser cleanup

## Security Considerations

### 1. Credential Management
- Environment variable support for production
- Configuration file exclusion from version control
- No credential logging or exposure
- Secure credential validation

### 2. Input Sanitization
- All user inputs validated before processing
- SQL injection prevention (though not applicable here)
- XSS prevention in form inputs
- Path traversal prevention for config files

### 3. Browser Security
- Sandboxed browser execution
- No persistent browser data
- Minimal browser permissions
- Secure browser argument configuration

### 4. Rate Limiting
- Configurable delays between actions
- Respectful automation practices
- Timeout management to prevent hanging

## Performance Optimizations

### 1. Browser Management
- Efficient browser lifecycle management
- Minimal resource usage
- Proper cleanup procedures
- Optimized viewport settings

### 2. Selector Strategies
- Priority-ordered selector lists
- Efficient element detection
- Minimal DOM queries
- Smart waiting strategies

### 3. Network Optimization
- Efficient page loading strategies
- Minimal network requests
- Optimized navigation patterns

## Dependencies

### Core Dependencies
- **puppeteer**: Web automation and browser control
- **commander**: CLI argument parsing and command structure
- **moment**: Date/time manipulation and formatting
- **chalk**: Colored console output for better UX
- **dotenv**: Environment variable loading

### Development Dependencies
- **nodemon**: Development server with auto-restart

## Testing Strategy

### Manual Testing
- Debug mode for visual verification
- Detailed error logging for issue diagnosis
- Comprehensive logging for troubleshooting
- Multiple environment testing

### Automated Testing Considerations
- Unit tests for utility functions
- Integration tests for booking workflow
- Configuration validation tests
- Error handling verification

## Future Enhancements

### Potential Improvements
1. **Scheduling**: Cron job integration for recurring bookings
2. **Notifications**: Email/SMS confirmation of successful bookings
3. **Multi-facility**: Batch booking for multiple facilities
4. **Conflict Detection**: Check for existing bookings before attempting
5. **Retry Logic**: Automatic retry on transient failures
6. **API Integration**: Direct API calls if Skedda provides them
7. **GUI Interface**: Web-based interface for non-technical users

### Scalability Considerations
- Multiple venue support
- User management system
- Booking history tracking
- Performance monitoring
- Load balancing for high usage

## Maintenance

### Regular Tasks
- Dependency updates
- Security patch application
- Configuration validation
- Log file management

### Monitoring
- Success/failure rate tracking
- Performance metrics
- Error pattern analysis
- User feedback integration
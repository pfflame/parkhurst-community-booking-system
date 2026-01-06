#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { loadConfig, validateConfig, getFacility, listFacilities } = require('./src/config');
const { isValidDate, isValidTime, isValidTimeRange, isValidBookingDate, log } = require('./src/utils');
const BookingAutomator = require('./src/booking');

// Load Qinglong notification module lazily to allow env var overrides
let sendNotify = null;

function loadNotifier() {
  if (sendNotify) return;

  try {
    // Look for sendNotify.js in parent directory (one level up)
    const notifyPath = path.join(__dirname, '..', 'sendNotify.js');
    if (require('fs').existsSync(notifyPath)) {
      // Clear cache to ensure we get a fresh instance if needed (though unlikely to be re-required)
      delete require.cache[require.resolve(notifyPath)];
      const { sendNotify: notify } = require(notifyPath);
      sendNotify = notify;
      log('Qinglong notification module loaded');
    }
  } catch (error) {
    // Notification module not available (running locally or Qinglong not installed)
    log('Running without Qinglong notifications');
  }
}

const program = new Command();

program
  .name('parkhurst-booking')
  .description('Automated community facility booking system for Parkhurst HOA')
  .version('1.0.0');

program
  .command('book')
  .description('Book a facility')
  .requiredOption('--facility <facility>', 'Facility to book (e.g., tennis_lower)')
  .option('--date <date>', 'Booking date (YYYY-MM-DD)')
  .option('--book-in-advance [days]', 'Number of days in advance to book (e.g., 14 for 14 days from today). If no value is provided, defaults to value in config or 14. Mutually exclusive with --date.')
  .requiredOption('--start-time <time>', 'Start time (HH:MM)')
  .requiredOption('--end-time <time>', 'End time (HH:MM)')
  .option('--profile <email_or_name>', 'User profile for credentials (email or name from config)')
  .option('--signature <signature>', 'Custom signature (overrides config)')
  .option('--title <title>', 'Custom booking title (overrides auto-generation)')
  .option('--notify-email <email>', 'Custom notification recipient email (overrides Qinglong env)')
  .option('--headless <boolean>', 'Run in headless mode', 'true')
  .option('--config <path>', 'Path to custom config file')
  .option('--force-date', 'Allow booking dates in the past (for testing or specific scenarios)')
  .action(async (options) => {
    // Set custom notification email if provided (Must be done before loading notifier)
    if (options.notifyEmail) {
      process.env.SMTP_TO = options.notifyEmail;
      log(`Overriding notification recipient to: ${options.notifyEmail}`);
    }

    // Initialize notifier
    loadNotifier();

    try {
      await executeBooking(options);
    } catch (error) {
      console.error(chalk.red(`❌ Booking failed: ${error.message}`));

      // Send error notification if Qinglong notification is available
      if (sendNotify) {
        try {
          await sendNotify(
            '🎾 Parkhurst Booking Failed',
            `❌ Booking attempt failed\n\nError: ${error.message}\n\nTimestamp: ${new Date().toLocaleString()}`
          );
        } catch (notifyError) {
          console.error(chalk.yellow(`Warning: Failed to send notification: ${notifyError.message}`));
        }
      }

      process.exit(1);
    }
  });

program
  .command('list')
  .description('List available facilities')
  .option('--config <path>', 'Custom config file path')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      validateConfig(config);

      const facilities = listFacilities(config);

      console.log(chalk.blue('\n📋 Available Facilities:'));
      console.log(chalk.gray('─'.repeat(50)));

      facilities.forEach(facility => {
        console.log(chalk.green(`🏢 ${facility.key}`));
        console.log(chalk.white(`   Name: ${facility.name}`));
        console.log(chalk.gray(`   Space ID: ${facility.spaceId}`));
        console.log();
      });

    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate configuration file')
  .option('--config <path>', 'Custom config file path')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      validateConfig(config);

      console.log(chalk.green('✅ Configuration is valid!'));
      console.log(chalk.blue(`📧 Email: ${config.credentials.email}`));
      console.log(chalk.blue(`🏢 Facilities: ${Object.keys(config.facilities).length}`));

    } catch (error) {
      console.error(chalk.red(`❌ Configuration error: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('examples')
  .description('Show usage examples')
  .action(() => {
    console.log(chalk.blue('\n📖 Usage Examples:'));
    console.log(chalk.gray('─'.repeat(50)));

    console.log(chalk.yellow('\n1. Basic booking:'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00'));

    console.log(chalk.yellow('\n2. Book with different profile (email):'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --profile "john.doe@example.com"'));

    console.log(chalk.yellow('\n3. Book with custom signature:'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --signature "JD"'));

    console.log(chalk.yellow('\n4. Book with profile and signature:'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --profile "jane.smith@example.com" --signature "JS"'));

    console.log(chalk.yellow('\n5. Book with custom title:'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --title "Tennis Practice"'));

    console.log(chalk.yellow('\n6. Complete example with all parameters:'));
    console.log(chalk.white('   node index.js book --facility tennis_upper --date 2025-06-15 --start-time 14:00 --end-time 16:00 --profile "jane.smith@company.org" --signature "JS" --title "Tournament Practice"'));

    console.log(chalk.yellow('\n7. Run in non-headless mode (for debugging):'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --headless false'));

    console.log(chalk.yellow('\n8. List available facilities:'));
    console.log(chalk.white('   node index.js list'));

    console.log(chalk.yellow('\n9. Validate configuration:'));
    console.log(chalk.white('   node index.js validate'));

    console.log(chalk.yellow('\n10. Book in advance (using default days from config):'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --book-in-advance --start-time 12:00 --end-time 13:00'));

    console.log(chalk.yellow('\n11. Book specific days in advance:'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --book-in-advance 10 --start-time 12:00 --end-time 13:00'));

    console.log(chalk.yellow('\n12. Book with custom notification recipient:'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 12:00 --end-time 13:00 --notify-email "user@example.com"'));

    console.log(chalk.yellow('\n📋 Profile and Signature Examples:'));
    console.log(chalk.white('   # Use a specific profile (requires PROFILE_JOHN_DOE_EXAMPLE_COM_PASSWORD in .env)'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 14:00 --end-time 15:00 --profile "john.doe@example.com"'));
    console.log(chalk.white('   # Override signature for any profile'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 14:00 --end-time 15:00 --signature "JS"'));
    console.log(chalk.white('   # Use profile with signature override'));
    console.log(chalk.white('   node index.js book --facility tennis_lower --date 2025-06-15 --start-time 14:00 --end-time 15:00 --profile "jane.smith@company.org" --signature "JS"'));

    console.log(chalk.blue('\n💡 Tips:'));
    console.log(chalk.gray('   • Use --headless false for debugging'));
    console.log(chalk.gray('   • Check available facilities with: node index.js list'));
    console.log(chalk.gray('   • Set up multiple profiles in .env: PROFILE_EMAIL_DOMAIN_COM_PASSWORD=password'));
    console.log(chalk.gray('   • Use --profile to specify a different email address'));
    console.log(chalk.gray('   • Use --signature to override the default signature'));
    console.log(chalk.gray('   • Profile signatures can be set with PROFILE_EMAIL_DOMAIN_COM_SIGNATURE=name'));
    console.log(chalk.gray('   • Booking title format: {start-15min} - {end+15min}'));
    console.log();
  });

function validateBookingParams(options, forceDate = false, config) {
  const errors = [];

  // Date validation (format, past date) is now handled in executeBooking before this function is called.
  // options.date should be populated and validated by the time we get here.
  if (!options.date || !isValidDate(options.date)) {
    // This should ideally not be hit if executeBooking's date logic is correct.
    errors.push('Booking date is missing or invalid after initial processing. This indicates an internal logic error.');
  }

  // Facility validation
  if (!options.facility) {
    errors.push(`Facility not specified. Use 'list' command to see available facilities.`);
  } else {
    const facilities = options.facility.split(',').map(f => f.trim());
    for (const fac of facilities) {
      if (!getFacility(config, fac)) {
        errors.push(`Facility '${fac}' not found. Use 'list' command to see available facilities.`);
      }
    }
  }

  if (!isValidTime(options.startTime)) {
    errors.push('Invalid start time format. Use HH:MM');
  }

  if (!isValidTime(options.endTime)) {
    errors.push('Invalid end time format. Use HH:MM');
  }

  if (isValidTime(options.startTime) && isValidTime(options.endTime)) {
    if (!isValidTimeRange(options.startTime, options.endTime)) {
      errors.push('Start time must be before end time');
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }
}

async function executeBooking(options) {
  const config = loadConfig(options.config, options.profile);
  validateConfig(config);

  let bookingDateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to start of day

  const defaultAdvanceDaysFromConfig = config.defaults?.bookInAdvanceDays;
  const hardcodedDefaultAdvanceDays = 14;

  if (options.date && options.bookInAdvance !== undefined) {
    console.error(chalk.red('Error: --date and --book-in-advance are mutually exclusive. Please use one or the other.'));
    process.exit(1);
  }

  let calculatedDate; // This will be a Date object

  if (options.bookInAdvance !== undefined) {
    let daysToAdvance;
    if (typeof options.bookInAdvance === 'string') {
      daysToAdvance = parseInt(options.bookInAdvance, 10);
      if (isNaN(daysToAdvance) || daysToAdvance < 0) {
        console.error(chalk.red('Error: --book-in-advance must be a non-negative integer if a value is provided.'));
        process.exit(1);
      }
    } else { // options.bookInAdvance is true (flag used without value)
      daysToAdvance = typeof defaultAdvanceDaysFromConfig === 'number' ? defaultAdvanceDaysFromConfig : hardcodedDefaultAdvanceDays;
      log(chalk.blue(`Using default days in advance: ${daysToAdvance} (from ${typeof defaultAdvanceDaysFromConfig === 'number' ? 'config' : 'hardcoded default'})`));
    }
    calculatedDate = new Date(today);
    calculatedDate.setDate(today.getDate() + daysToAdvance);
  } else if (options.date) {
    // Validate format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
      console.error(chalk.red('Error: Date format for --date must be YYYY-MM-DD.'));
      process.exit(1);
    }

    // Using simple manual parse to ensure local time 00:00:00 interpretation
    const parts = options.date.split('-');
    calculatedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

    if (isNaN(calculatedDate.getTime())) {
      console.error(chalk.red(`Error: Invalid date provided: ${options.date}`));
      process.exit(1);
    }
  } else {
    // Neither --date nor --book-in-advance provided, use default
    const daysToAdvance = typeof defaultAdvanceDaysFromConfig === 'number' ? defaultAdvanceDaysFromConfig : hardcodedDefaultAdvanceDays;
    log(chalk.blue(`Neither --date nor --book-in-advance specified. Using default days in advance: ${daysToAdvance} (from ${typeof defaultAdvanceDaysFromConfig === 'number' ? 'config' : 'hardcoded default'})`));
    calculatedDate = new Date(today);
    calculatedDate.setDate(today.getDate() + daysToAdvance);
  }

  if (!options.forceDate && calculatedDate < today) {
    console.error(chalk.red(`Error: Booking date ${calculatedDate.toISOString().split('T')[0]} is in the past. Use --force-date to override.`));
    process.exit(1);
  }

  // Fix: format date using local time to prevent timezone shifts (e.g. UTC+8 issues)
  const year = calculatedDate.getFullYear();
  const month = String(calculatedDate.getMonth() + 1).padStart(2, '0');
  const day = String(calculatedDate.getDate()).padStart(2, '0');

  bookingDateStr = `${year}-${month}-${day}`;
  options.date = bookingDateStr; // Update options.date to be used by the rest of the function

  // The rest of executeBooking continues from here, using options.date (which is now bookingDateStr)
  // and config (which is already loaded).
  // Validate email format if profile is provided
  if (options.profile) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(options.profile)) {
      throw new Error('Invalid email format for profile');
    }
  }

  // Basic parameter validation (facility, times) - date is validated above.
  validateBookingParams(options, options.forceDate, config); // Pass config for facility check


  // Override signature if provided (takes precedence over profile signature)
  if (options.signature) {
    config.defaults.signature = options.signature;
  }

  // Parse facilities (support comma-separated inputs for fallback)
  const facilityKeys = options.facility.split(',').map(f => f.trim());
  const facilitiesToTry = [];

  for (const key of facilityKeys) {
    const fac = getFacility(config, key);
    if (fac) {
      facilitiesToTry.push(fac);
    }
    // getFacility throws if not found, so we don't need else here unless we change getFacility behavior
  }

  const headless = options.headless === 'true' || options.headless === true;

  console.log(chalk.blue('\n🎯 Booking Summary:'));
  console.log(chalk.gray('─'.repeat(30)));
  console.log(chalk.white(`📧 Email: ${config.credentials.email}`));
  console.log(chalk.white(`📅 Date: ${options.date}${options.bookInAdvance ? ` (calculated from ${options.bookInAdvance} days in advance)` : ''}`));
  console.log(chalk.white(`⏰ Time: ${options.startTime} - ${options.endTime}`));
  console.log(chalk.white(`🏢 Facility Target(s): ${facilitiesToTry.map(f => f.name).join(' -> ')}`));
  console.log(chalk.white(`✍️  Signature: ${config.defaults.signature}`));
  console.log(chalk.white(`🤖 Headless: ${headless ? 'Yes' : 'No'}`));

  if (options.title) {
    console.log(chalk.white(`📝 Custom Title: ${options.title}`));
  }

  console.log();

  // Try each facility in order
  let success = false;
  let lastError = null;

  for (let i = 0; i < facilitiesToTry.length; i++) {
    const facility = facilitiesToTry[i];
    console.log(chalk.yellow(`\n👉 Attempt ${i + 1}/${facilitiesToTry.length}: Booking ${facility.name} (${facility.key})...`));

    const automator = new BookingAutomator(config);

    try {
      await automator.book({
        facility,
        date: options.date,
        startTime: options.startTime,
        endTime: options.endTime,
        signature: config.defaults.signature,
        customTitle: options.title,
        headless
      });

      console.log(chalk.green(`\n✅ Successfully booked: ${facility.name}`));
      success = true;

      // Send success notification if Qinglong notification is available
      if (sendNotify) {
        try {
          const notificationTitle = '🎾 Parkhurst Booking Success';
          const notificationBody = `✅ Booking confirmed!\n\n` +
            `📧 User: ${config.credentials.email}\n` +
            `📅 Date: ${options.date}\n` +
            `⏰ Time: ${options.startTime} - ${options.endTime}\n` +
            `🏢 Facility: ${facility.name}\n` +
            `✍️  Signature: ${config.defaults.signature}\n\n` +
            `Timestamp: ${new Date().toLocaleString()}`;

          await sendNotify(notificationTitle, notificationBody);
          log('Notification sent successfully');
        } catch (notifyError) {
          console.error(chalk.yellow(`Warning: Failed to send notification: ${notifyError.message}`));
        }
      }

      // Stop trying if successful
      break;

    } catch (error) {
      console.error(chalk.red(`❌ Attempt failed for ${facility.name}: ${error.message}`));
      lastError = error;

      if (i < facilitiesToTry.length - 1) {
        console.log(chalk.blue(`⏳ Retrying with next facility in fallback list...`));
      } else {
        console.log(chalk.red(`\n⛔ All facility options exhausted.`));
      }
    }
  }

  // If we exhausted all options without success, fail the process
  if (!success) {
    console.error(chalk.red('\n❌ Final Result: Booking failed for all requested facilities.'));

    // Send error notification if Qinglong notification is available
    // Using the last error message as context
    if (sendNotify) {
      try {
        await sendNotify(
          '🎾 Parkhurst Booking Failed',
          `❌ All booking attempts failed\n\nTarget(s): ${facilitiesToTry.map(f => f.name).join(', ')}\nLast Error: ${lastError ? lastError.message : 'Unknown error'}\n\nTimestamp: ${new Date().toLocaleString()}`
        );
      } catch (notifyError) {
        console.error(chalk.yellow(`Warning: Failed to send notification: ${notifyError.message}`));
      }
    }

    process.exit(1);
  } else {
    console.log(chalk.green('\n✅ Booking process completed successfully!'));
  }
}

process.on('uncaughtException', (error) => {
  console.error(chalk.red(`❌ Uncaught Exception: ${error.message}`));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red(`❌ Unhandled Rejection: ${reason}`));
  process.exit(1);
});

if (process.argv.length === 2) {
  program.help();
} else {
  program.parse();
}
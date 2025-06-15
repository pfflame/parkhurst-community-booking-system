#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { loadConfig, validateConfig, getFacility, listFacilities } = require('./src/config');
const { isValidDate, isValidTime, isValidTimeRange, isValidBookingDate, log } = require('./src/utils');
const BookingAutomator = require('./src/booking');

const program = new Command();

program
  .name('parkhurst-booking')
  .description('Automated community facility booking system for Parkhurst HOA')
  .version('1.0.0');

program
  .command('book')
    .description('Book a facility')
    .requiredOption('-f, --facility <facility>', 'Facility to book (e.g., tennis_lower)')
    .option('-d, --date <date>', 'Booking date (YYYY-MM-DD)')
    .option('--book-in-advance-days [days]', 'Number of days in advance to book (e.g., 15 for 15 days from today). If no value is provided, defaults to value in config or 15. Mutually exclusive with --date.')
    .requiredOption('-s, --start <time>', 'Start time (HH:MM)')
    .requiredOption('-e, --end <time>', 'End time (HH:MM)')
    .option('--profile <email_or_name>', 'User profile for credentials (email or name from config)')
    .option('--signature <signature>', 'Custom signature (overrides config)')
    .option('--title <title>', 'Custom booking title (overrides auto-generation)')
    .option('--headless <boolean>', 'Run in headless mode', 'true')
    .option('--config <path>', 'Path to custom config file')
    .option('--force-date', 'Allow booking dates in the past (for testing or specific scenarios)')
  .action(async (options) => {
    try {
      await executeBooking(options);
    } catch (error) {
      console.error(chalk.red(`❌ Booking failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List available facilities')
  .option('-c, --config <path>', 'Custom config file path')
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
  .option('-c, --config <path>', 'Custom config file path')
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
    console.log(chalk.white('   node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00'));
    
    console.log(chalk.yellow('\n2. Book with different profile (email):'));
    console.log(chalk.white('   node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00 --profile "john.doe@example.com"'));
    
    console.log(chalk.yellow('\n3. Book with custom signature:'));
    console.log(chalk.white('   node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00 --signature "JD"'));
    
    console.log(chalk.yellow('\n4. Book with profile and signature:'));
    console.log(chalk.white('   node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00 --profile "jane.smith@example.com" --signature "JS"'));
    
    console.log(chalk.yellow('\n5. Book with custom title:'));
    console.log(chalk.white('   node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00 --title "Tennis Practice"'));
    
    console.log(chalk.yellow('\n6. Complete example with all parameters:'));
    console.log(chalk.white('   node index.js book -f tennis_upper -d 2025-06-15 -s 14:00 -e 16:00 --profile "jane.smith@company.org" --signature "JS" --title "Tournament Practice"'));
    
    console.log(chalk.yellow('\n7. Run in non-headless mode (for debugging):'));
    console.log(chalk.white('   node index.js book -f tennis_lower -d 2025-06-15 -s 12:00 -e 13:00 --headless false'));
    
    console.log(chalk.yellow('\n8. List available facilities:'));
    console.log(chalk.white('   node index.js list'));
    
    console.log(chalk.yellow('\n9. Validate configuration:'));
    console.log(chalk.white('   node index.js validate'));
    
    console.log(chalk.yellow('\n📋 Profile and Signature Examples:'));
    console.log(chalk.white('   # Use a specific profile (requires PROFILE_JOHN_DOE_EXAMPLE_COM_PASSWORD in .env)'));
    console.log(chalk.white('   node index.js book -f tennis_lower -d 2025-06-15 -s 14:00 -e 15:00 --profile "john.doe@example.com"'));
    console.log(chalk.white('   # Override signature for any profile'));
    console.log(chalk.white('   node index.js book -f tennis_lower -d 2025-06-15 -s 14:00 -e 15:00 --signature "JS"'));
    console.log(chalk.white('   # Use profile with signature override'));
    console.log(chalk.white('   node index.js book -f tennis_lower -d 2025-06-15 -s 14:00 -e 15:00 --profile "jane.smith@company.org" --signature "JS"'));
    
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

function validateBookingParams(options, forceDate = false, config) { // Added config parameter
  const errors = [];
  
  // Date validation (format, past date) is now handled in executeBooking before this function is called.
  // options.date should be populated and validated by the time we get here.
  if (!options.date || !isValidDate(options.date)) {
    // This should ideally not be hit if executeBooking's date logic is correct.
    errors.push('Booking date is missing or invalid after initial processing. This indicates an internal logic error.');
  }

  // Facility validation
  if (!options.facility || !getFacility(config, options.facility)) {
      errors.push(`Facility '${options.facility || ''}' not found or not specified. Use 'list' command to see available facilities.`);
  }
  
  if (!isValidTime(options.start)) {
    errors.push('Invalid start time format. Use HH:MM');
  }
  
  if (!isValidTime(options.end)) {
    errors.push('Invalid end time format. Use HH:MM');
  }
  
  if (isValidTime(options.start) && isValidTime(options.end)) {
    if (!isValidTimeRange(options.start, options.end)) {
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
  const hardcodedDefaultAdvanceDays = 15;

  if (options.date && options.bookInAdvanceDays !== undefined) {
    console.error(chalk.red('Error: --date and --book-in-advance-days are mutually exclusive. Please use one or the other.'));
    process.exit(1);
  }

  let calculatedDate; // This will be a Date object

  if (options.bookInAdvanceDays !== undefined) {
    let daysToAdvance;
    if (typeof options.bookInAdvanceDays === 'string') {
      daysToAdvance = parseInt(options.bookInAdvanceDays, 10);
      if (isNaN(daysToAdvance) || daysToAdvance < 0) {
        console.error(chalk.red('Error: --book-in-advance-days must be a non-negative integer if a value is provided.'));
        process.exit(1);
      }
    } else { // options.bookInAdvanceDays is true (flag used without value)
      daysToAdvance = typeof defaultAdvanceDaysFromConfig === 'number' ? defaultAdvanceDaysFromConfig : hardcodedDefaultAdvanceDays;
      log(chalk.blue(`Using default days in advance: ${daysToAdvance} (from ${typeof defaultAdvanceDaysFromConfig === 'number' ? 'config' : 'hardcoded default'})`));
    }
    calculatedDate = new Date(today);
    calculatedDate.setDate(today.getDate() + daysToAdvance);
  } else if (options.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
        console.error(chalk.red('Error: Date format for --date must be YYYY-MM-DD.'));
        process.exit(1);
    }
    const parts = options.date.split('-');
    calculatedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(calculatedDate.getTime())) {
        console.error(chalk.red(`Error: Invalid date provided: ${options.date}`));
        process.exit(1);
    }
  } else {
    // Neither --date nor --book-in-advance-days provided, use default
    const daysToAdvance = typeof defaultAdvanceDaysFromConfig === 'number' ? defaultAdvanceDaysFromConfig : hardcodedDefaultAdvanceDays;
    log(chalk.blue(`Neither --date nor --book-in-advance specified. Using default days in advance: ${daysToAdvance} (from ${typeof defaultAdvanceDaysFromConfig === 'number' ? 'config' : 'hardcoded default'})`));
    calculatedDate = new Date(today);
    calculatedDate.setDate(today.getDate() + daysToAdvance);
  }

  if (!options.forceDate && calculatedDate < today) {
    console.error(chalk.red(`Error: Booking date ${calculatedDate.toISOString().split('T')[0]} is in the past. Use --force-date to override.`));
    process.exit(1);
  }

  bookingDateStr = calculatedDate.toISOString().split('T')[0];
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
  
  const facility = getFacility(config, options.facility);
  const headless = options.headless === 'true' || options.headless === true;
  
  console.log(chalk.blue('\n🎯 Booking Summary:'));
  console.log(chalk.gray('─'.repeat(30)));
  console.log(chalk.white(`📧 Email: ${config.credentials.email}`));
  console.log(chalk.white(`📅 Date: ${options.date}${options.bookInAdvanceDays ? ` (calculated from ${options.bookInAdvanceDays} days in advance)` : ''}`));
  console.log(chalk.white(`⏰ Time: ${options.start} - ${options.end}`));
  console.log(chalk.white(`🏢 Facility: ${facility.name}`));
  console.log(chalk.white(`✍️  Signature: ${config.defaults.signature}`));
  console.log(chalk.white(`🤖 Headless: ${headless ? 'Yes' : 'No'}`));
  
  if (options.title) {
    console.log(chalk.white(`📝 Custom Title: ${options.title}`));
  }
  
  console.log();
  
  const automator = new BookingAutomator(config);
  
  await automator.book({
    facility,
    date: options.date,
    startTime: options.start,
    endTime: options.end,
    signature: config.defaults.signature,
    customTitle: options.title,
    headless
  });
  
  console.log(chalk.green('\n✅ Booking process completed successfully!'));
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
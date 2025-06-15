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
  .description('Book a community facility')
  .requiredOption('-f, --facility <facility>', 'Facility to book (e.g., tennis_lower)')
  .requiredOption('-d, --date <date>', 'Booking date (YYYY-MM-DD)')
  .requiredOption('-s, --start <time>', 'Start time (HH:MM)')
  .requiredOption('-e, --end <time>', 'End time (HH:MM)')
  .option('-p, --profile <email>', 'Email address for booking (overrides config)')
  .option('-sig, --signature <signature>', 'Custom signature (overrides config)')
  .option('-t, --title <title>', 'Custom booking title (overrides auto-generation)')
  .option('--headless <boolean>', 'Run in headless mode', 'true')
  .option('-c, --config <path>', 'Custom config file path')
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

function validateBookingParams(options) {
  const errors = [];
  
  if (!isValidDate(options.date)) {
    errors.push('Invalid date format. Use YYYY-MM-DD');
  } else if (!isValidBookingDate(options.date)) {
    errors.push('Booking date cannot be in the past');
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
  // Validate email format if profile is provided
  if (options.profile) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(options.profile)) {
      throw new Error('Invalid email format for profile');
    }
  }
  
  // Load configuration with profile support
  const config = loadConfig(options.config, options.profile);
  validateConfig(config);
  validateBookingParams(options);
  
  // Override signature if provided (takes precedence over profile signature)
  if (options.signature) {
    config.defaults.signature = options.signature;
  }
  
  const facility = getFacility(config, options.facility);
  const headless = options.headless === 'true' || options.headless === true;
  
  console.log(chalk.blue('\n🎯 Booking Summary:'));
  console.log(chalk.gray('─'.repeat(30)));
  console.log(chalk.white(`📧 Email: ${config.credentials.email}`));
  console.log(chalk.white(`📅 Date: ${options.date}`));
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
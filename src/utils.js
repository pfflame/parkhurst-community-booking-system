const moment = require('moment');

/**
 * Formats booking title with buffer time
 */
function formatBookingTitle(startTime, endTime, bufferMinutes = 15) {
  const startMoment = moment(startTime, 'HH:mm').subtract(bufferMinutes, 'minutes');
  const endMoment = moment(endTime, 'HH:mm').add(bufferMinutes, 'minutes');
  
  return `${startMoment.format('h:mmA')} - ${endMoment.format('h:mmA')}`;
}

/**
 * Converts time string to ISO format for URL
 */
function timeToISO(date, time) {
  return `${date}T${time}:00`;
}

/**
 * Generates booking URL with parameters
 */
function generateBookingUrl({ baseUrl, spaceId, date, startTime, endTime }) {
  const startISO = encodeURIComponent(timeToISO(date, startTime));
  const endISO = encodeURIComponent(timeToISO(date, endTime));
  
  return `${baseUrl}?nbend=${endISO}&nbspaces=${spaceId}&nbstart=${startISO}`;
}

/**
 * Validates date format (YYYY-MM-DD)
 */
function isValidDate(date) {
  return moment(date, 'YYYY-MM-DD', true).isValid();
}

/**
 * Validates time format (HH:MM)
 */
function isValidTime(time) {
  return moment(time, 'HH:mm', true).isValid();
}

/**
 * Validates time range (start before end)
 */
function isValidTimeRange(startTime, endTime) {
  const start = moment(startTime, 'HH:mm');
  const end = moment(endTime, 'HH:mm');
  return start.isBefore(end);
}

/**
 * Validates booking date (not in the past)
 */
function isValidBookingDate(date) {
  const bookingDate = moment(date, 'YYYY-MM-DD');
  const today = moment().startOf('day');
  return bookingDate.isSameOrAfter(today);
}

/**
 * Adds delay for timing control
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Logs message with timestamp
 */
function log(message, level = 'info') {
  const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  switch (level) {
    case 'error':
      console.error(`${prefix} ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ${message}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

module.exports = {
  formatBookingTitle,
  timeToISO,
  generateBookingUrl,
  isValidDate,
  isValidTime,
  isValidTimeRange,
  isValidBookingDate,
  delay,
  log
};
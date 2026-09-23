const assert = require('node:assert/strict');

const { isBookingSuccessUrl } = require('../src/booking-url');
const {
  FATAL_ALERT_SCORE,
  isBookingSuccessMessage,
  rankBookingAlerts
} = require('../src/booking-messages');

const configuredBaseUrl = 'https://parkhurst.skedda.com/booking';

// The exact banners observed on parkhurst.allbooked.com.
const confirmationBanner = 'Too easy - your booking is confirmed.';
const quotaBanner = "This booking cannot be confirmed because it would mean that your quota is exceeded for the day 8/21/26. Specifically, you are allowed an individual maximum of 1h across the space(s) Tennis - Lower Court Whole, Tennis -- Upper Court Whole, Basketball Court - Whole. You can check your current usage on the List mode under 'My Bookings'.";

function test(name, assertion) {
  assertion();
  console.log(`✓ ${name}`);
}

test('accepts the legacy booking completion URL', () => {
  assert.equal(isBookingSuccessUrl(configuredBaseUrl, 'https://parkhurst.skedda.com/booking'), true);
});

test('accepts the migrated AllBooked booking completion URL', () => {
  assert.equal(isBookingSuccessUrl(configuredBaseUrl, 'https://parkhurst.allbooked.com/booking'), true);
});

test('rejects a URL that still contains new-booking parameters', () => {
  assert.equal(
    isBookingSuccessUrl(
      configuredBaseUrl,
      'https://parkhurst.allbooked.com/booking?nbend=2026-07-18T18%3A00%3A00&nbspaces=1244467&nbstart=2026-07-18T17%3A00%3A00'
    ),
    false
  );
});

test('rejects a different page', () => {
  assert.equal(isBookingSuccessUrl(configuredBaseUrl, 'https://app.allbooked.com/account/login'), false);
});

test('rejects the booking path on an unrelated host', () => {
  assert.equal(isBookingSuccessUrl(configuredBaseUrl, 'https://example.com/booking'), false);
});

test('rejects a completion URL using an unexpected protocol', () => {
  assert.equal(isBookingSuccessUrl(configuredBaseUrl, 'http://parkhurst.allbooked.com/booking'), false);
});

test('recognises the confirmation banner as success', () => {
  assert.equal(isBookingSuccessMessage(confirmationBanner), true);
});

test('does not read the quota rejection as a confirmation', () => {
  assert.equal(isBookingSuccessMessage(quotaBanner), false);
});

test('the confirmation banner is not fatal, even in an alert element', () => {
  const { highestScore } = rankBookingAlerts([{ text: confirmationBanner, isDanger: false }]);
  assert.ok(highestScore < FATAL_ALERT_SCORE, `expected non-fatal score, got ${highestScore}`);
});

test('the quota rejection is still fatal', () => {
  const { bestCandidate, highestScore } = rankBookingAlerts([{ text: quotaBanner, isDanger: true }]);
  assert.ok(highestScore >= FATAL_ALERT_SCORE);
  assert.equal(bestCandidate, quotaBanner);
});

test('the confirmation banner is not fatal even inside a danger element', () => {
  const { highestScore } = rankBookingAlerts([{ text: confirmationBanner, isDanger: true }]);
  assert.ok(highestScore < FATAL_ALERT_SCORE, `expected non-fatal score, got ${highestScore}`);
});

test('an unrecognised banner in a danger element is still fatal', () => {
  const { highestScore } = rankBookingAlerts([{ text: 'Something unexpected happened.', isDanger: true }]);
  assert.ok(highestScore >= FATAL_ALERT_SCORE);
});

test('an unrecognised non-danger banner defers to the URL check', () => {
  const { highestScore } = rankBookingAlerts([{ text: 'Welcome back to Parkhurst.', isDanger: false }]);
  assert.ok(highestScore < FATAL_ALERT_SCORE);
});

test('a real error outranks a stale confirmation banner on the same page', () => {
  const { bestCandidate } = rankBookingAlerts([
    { text: confirmationBanner, isDanger: false },
    { text: quotaBanner, isDanger: true }
  ]);
  assert.equal(bestCandidate, quotaBanner);
});

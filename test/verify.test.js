// Tests for the polling verification loop in BookingAutomator.
// The page is stubbed, so no browser is launched - but requiring src/booking.js
// still pulls in puppeteer, which is why these live apart from the pure-module
// tests in booking.test.js.

const assert = require('node:assert/strict');

// Keep fixture output out of booking_errors.log.
process.env.BOOKING_DISABLE_FILE_LOG = '1';

const BookingAutomator = require('../src/booking');

const confirmation = 'Too easy - your booking is confirmed.';
const quota = "This booking cannot be confirmed because it would mean that your quota is exceeded for the day 8/21/26. Specifically, you are allowed an individual maximum of 1h across the space(s) Tennis - Lower Court Whole, Tennis -- Upper Court Whole, Basketball Court - Whole. You can check your current usage on the List mode under 'My Bookings'.";

const formUrl = 'https://parkhurst.allbooked.com/booking?nbend=2026-08-21T17%3A00%3A00&nbspaces=1244466&nbstart=2026-08-21T16%3A00%3A00';
const doneUrl = 'https://parkhurst.allbooked.com/booking';

// Tiny timings keep the suite instant while exercising the real loop.
const config = {
  urls: { baseUrl: 'https://parkhurst.skedda.com/booking' },
  defaults: { verifySettleMs: 5, verifyPollIntervalMs: 5, verifyTimeoutMs: 200 }
};

/**
 * Builds an automator whose page advances one "poll" each time the
 * verification loop samples the alerts.
 */
function makeAutomator({ urlAt, alertsAt }) {
  const automator = new BookingAutomator(config);
  let poll = 0;

  automator.page = {
    url: () => urlAt(poll),
    title: async () => 'Booking System - Parkhurst HOA. Fullerton | Skedda'
  };

  automator.extractPageAlerts = async () => {
    const alerts = alertsAt(poll);
    poll++;
    return alerts;
  };

  return automator;
}

async function test(name, fn) {
  await fn();
  console.log(`✓ ${name}`);
}

async function main() {
  await test('succeeds when the confirmation toast appears only on a later poll', async () => {
    // The Aug 7 race, inverted: the toast is absent at first and shows up late.
    const automator = makeAutomator({
      urlAt: () => formUrl,
      alertsAt: (poll) => (poll >= 3 ? [{ text: confirmation, isDanger: false }] : [])
    });

    assert.equal(await automator.verifyBookingSuccess(), true);
  });

  await test('succeeds when the redirect lands after the old 5s sample point', async () => {
    // Old code sampled once and would have failed this; polling waits for it.
    const automator = makeAutomator({
      urlAt: (poll) => (poll >= 4 ? doneUrl : formUrl),
      alertsAt: () => []
    });

    assert.equal(await automator.verifyBookingSuccess(), true);
  });

  await test('succeeds when the confirmation sits inside a danger-styled wrapper', async () => {
    const automator = makeAutomator({
      urlAt: () => formUrl,
      alertsAt: () => [{ text: confirmation, isDanger: true }]
    });

    assert.equal(await automator.verifyBookingSuccess(), true);
  });

  await test('still fails on the quota rejection', async () => {
    const automator = makeAutomator({
      urlAt: () => formUrl,
      alertsAt: () => [{ text: quota, isDanger: true }]
    });

    await assert.rejects(
      () => automator.verifyBookingSuccess(),
      (error) => error.bookingErrorMessage === quota
    );
  });

  await test('fails on timeout and reports alerts seen along the way', async () => {
    const automator = makeAutomator({
      urlAt: () => formUrl,
      // A transient banner visible on one poll only must survive into the message.
      alertsAt: (poll) => (poll === 2 ? [{ text: 'Only verified residents may book.', isDanger: false }] : [])
    });

    await assert.rejects(
      () => automator.verifyBookingSuccess(),
      (error) => {
        assert.match(error.bookingErrorMessage, /Only verified residents may book\./);
        return true;
      }
    );
  });

  // The retry in index.js keys off bookingErrorMessage to decide what is safe to
  // repeat. These two assert that contract from both sides.
  await test('a post-submit failure is marked non-retryable', async () => {
    const automator = makeAutomator({ urlAt: () => formUrl, alertsAt: () => [] });

    await assert.rejects(
      () => automator.verifyBookingSuccess(),
      // bookingErrorMessage present => never retried => cannot double-book.
      (error) => typeof error.bookingErrorMessage === 'string' && error.bookingErrorMessage.length > 0
    );
  });

  await test('a missing title field is a retryable pre-submit failure', async () => {
    const automator = new BookingAutomator(config);
    automator.page = {
      waitForSelector: async () => true,
      $: async () => null // no field matches any selector
    };

    await assert.rejects(
      () => automator.fillBookingForm('4:45PM - 5:15PM', 'ZZ'),
      (error) => {
        assert.match(error.message, /title field not found/);
        // No bookingErrorMessage => retryable, and it happens before submit.
        assert.equal(error.bookingErrorMessage, undefined);
        return true;
      }
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

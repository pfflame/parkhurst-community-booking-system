const puppeteer = require('puppeteer');
const { formatBookingTitle, generateBookingUrl, delay, log } = require('./utils');
const { isBookingSuccessUrl } = require('./booking-url');
const {
  FATAL_ALERT_SCORE,
  isBookingSuccessMessage,
  rankBookingAlerts
} = require('./booking-messages');

const fs = require('fs');

class BookingAutomator {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async initialize(headless = true) {
    log('Initializing browser...');

    // Use system Chromium (installed via install-chromium.sh)
    // Falls back to Puppeteer's bundled Chrome if Chromium not found
    // Use system Chromium if available (specifically for Qinglong Docker deployment)
    // otherwise fallback to bundled Chrome (for local macOS/Windows dev)
    const chromiumPath = '/usr/bin/chromium';
    if (fs.existsSync(chromiumPath)) {
      log('Using system Chromium at ' + chromiumPath);
      this.browser = await puppeteer.launch({
        headless,
        executablePath: chromiumPath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    } else {
      log('System Chromium not found, using bundled browser');
      this.browser = await puppeteer.launch({
        headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    }
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });
    log('Browser initialized successfully');
  }

  async navigateAndLogin(bookingUrl) {
    log(`Navigating to: ${bookingUrl}`);
    await this.page.goto(bookingUrl, { waitUntil: 'networkidle2' });

    const isLoggedIn = await this.page.$('.booking-form, #booking-form, form[action*="booking"]');
    if (isLoggedIn) {
      log('Already logged in, proceeding to booking form');
      return;
    }

    await this.performLogin();
  }

  async performLogin() {
    log('Performing login...');

    await this.page.waitForSelector('input[type="email"], input[name="email"], #email', { timeout: 10000 });

    const emailSelector = await this.page.$('input[type="email"], input[name="email"], #email');
    const passwordSelector = await this.page.$('input[type="password"], input[name="password"], #password');

    if (!emailSelector || !passwordSelector) {
      throw new Error('Login form not found');
    }

    await emailSelector.type(this.config.credentials.email);
    await passwordSelector.type(this.config.credentials.password);

    const submitButton = await this.page.$('button[type="submit"], input[type="submit"], .btn-primary');
    if (submitButton) {
      await submitButton.click();
    } else {
      await this.page.keyboard.press('Enter');
    }

    await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    log('Login completed successfully');
  }

  async fillBookingForm(bookingTitle, signature) {
    log('Filling booking form...');

    await this.page.waitForSelector('input, textarea, select', { timeout: 10000 });

    const titleSelectors = [
      'input[name*="title"]',
      'input[placeholder*="title"]',
      'textarea[name*="title"]',
      '#booking-title',
      '.booking-title input'
    ];

    let titleFilled = false;

    for (const selector of titleSelectors) {
      const element = await this.page.$(selector);
      if (element) {
        await element.click({ clickCount: 3 });
        await element.type(bookingTitle);
        log(`Booking title filled: ${bookingTitle}`);
        titleFilled = true;
        break;
      }
    }

    // Fail before submitting rather than creating a booking with a blank title.
    // A plain Error (no bookingErrorMessage) marks this as a pre-submit failure,
    // which the caller may safely retry.
    if (!titleFilled) {
      throw new Error('Booking title field not found - the booking form markup may have changed');
    }

    const signatureSelectors = [
      'input[name*="signature"]',
      'input[placeholder*="signature"]',
      'input[placeholder*="initial"]',
      '#signature',
      '.signature input'
    ];

    let signatureFilled = false;

    for (const selector of signatureSelectors) {
      const element = await this.page.$(selector);
      if (element) {
        await element.click({ clickCount: 3 });
        await element.type(signature);
        log(`Signature filled: ${signature}`);
        signatureFilled = true;
        break;
      }
    }

    // Warn rather than throw: the signature field may legitimately be optional,
    // and blocking every booking over it would be worse than submitting without.
    if (!signatureFilled) {
      log('Warning: signature field not found - submitting without a signature', 'warn');
    }

    await delay(1000);
  }

  async submitBooking() {
    log('Submitting booking...');

    const buttonSelectors = [
      '.row.pt-5 .col-12 button.btn.btn-success',
      'button.btn.btn-success',
      'button[type="submit"]',
      '.btn-success',
      '.confirm-booking'
    ];

    const textBasedSelectors = ['Confirm', 'Book', 'Submit'];

    let confirmButton = null;

    for (const selector of buttonSelectors) {
      const buttons = await this.page.$$(selector);
      for (const button of buttons) {
        const isVisible = await button.isIntersectingViewport();
        const isEnabled = await button.evaluate(el => !el.disabled);

        if (isVisible && isEnabled) {
          confirmButton = button;
          log(`Found confirm button with selector: ${selector}`);
          break;
        }
      }
      if (confirmButton) break;
    }

    if (!confirmButton) {
      for (const text of textBasedSelectors) {
        const button = await this.page.evaluateHandle((searchText) => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(btn =>
            btn.textContent.trim().toLowerCase().includes(searchText.toLowerCase()) &&
            !btn.disabled &&
            btn.offsetParent !== null
          );
        }, text);

        if (button && button.asElement()) {
          confirmButton = button.asElement();
          log(`Found confirm button with text: ${text}`);
          break;
        }
      }
    }

    if (!confirmButton) {
      throw new Error('Confirm booking button not found or not clickable');
    }

    await confirmButton.scrollIntoView();
    await delay(500);

    try {
      await confirmButton.click();
      log('Booking submitted with standard click');
    } catch (error) {
      log('Standard click failed, trying JavaScript click');
      await confirmButton.evaluate(el => el.click());
    }

    await this.handlePostSubmissionDialogs();
    // verifyBookingSuccess includes its own delay to wait for redirects or messages.
    await this.verifyBookingSuccess();
  }

  async handlePostSubmissionDialogs() {
    log('Checking for post-submission dialogs...');

    const modalSelectors = [
      '.modal button.btn-success',
      '.modal button.btn-primary',
      '.popup button[type="submit"]',
      '.dialog .confirm'
    ];

    const modalTextSelectors = ['OK', 'Confirm'];

    for (const selector of modalSelectors) {
      const button = await this.page.$(selector);
      if (button) {
        const isVisible = await button.isIntersectingViewport();
        if (isVisible) {
          await button.click();
          log(`Clicked modal confirmation: ${selector}`);
          await delay(1000);
          return;
        }
      }
    }

    for (const text of modalTextSelectors) {
      const button = await this.page.evaluateHandle((searchText) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn =>
          btn.textContent.trim().toLowerCase().includes(searchText.toLowerCase()) &&
          !btn.disabled &&
          btn.offsetParent !== null &&
          (btn.closest('.modal') || btn.closest('.popup') || btn.closest('.dialog'))
        );
      }, text);

      if (button && button.asElement()) {
        await button.asElement().click();
        log(`Clicked modal confirmation with text: ${text}`);
        await delay(1000);
        return;
      }
    }
  }

  createBookingError(message, currentUrl = null, pageTitle = null) {
    const error = new Error(message);
    error.bookingErrorMessage = message;
    error.currentUrl = currentUrl;
    error.pageTitle = pageTitle;
    return error;
  }

  async extractPageAlerts() {
    // Collect every visible alert, not just the danger-styled ones: the
    // confirmation banner shares the same [role="alert"] markup and is needed as
    // positive evidence. Each alert is tagged so it can be classified later.
    const alertSelectors = [
      '.alert',
      '[role="alert"]',
      '.booking-error',
      '.error-message',
      '.invalid-feedback',
      '[class*="error"]'
    ];

    const dangerSelector = '.alert-danger, .booking-error, .error-message, .invalid-feedback, [class*="error"]';
    const nonDangerSelector = '.alert-success, .alert-info';

    return this.page.evaluate((selectors, dangerMatch, nonDangerMatch) => {
      const normalizeText = (text) => text.replace(/\s+/g, ' ').trim();
      const isVisible = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0;
      };

      const alerts = [];
      const seen = new Set();

      for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
          if (!isVisible(element)) continue;

          const text = normalizeText(element.innerText || element.textContent || '');
          if (!text || seen.has(text)) continue;

          seen.add(text);
          alerts.push({
            text,
            isDanger: element.matches(dangerMatch) && !element.matches(nonDangerMatch)
          });
        }
      }

      return alerts;
    }, alertSelectors, dangerSelector, nonDangerSelector);
  }

  async verifyBookingSuccess() {
    log('Verifying booking success...');

    // The confirmation banner is a transient toast: sampling the page once at a
    // fixed offset can either catch a toast that has not yet cleared or miss a
    // redirect that lands a moment later. Poll instead, and stop at the first
    // terminal signal. The primary success indicator is redirection to the
    // booking path without the new-booking query parameters. Skedda may migrate
    // the tenant to a new hostname (for example, skedda.com -> allbooked.com),
    // so do not require an exact hostname match here.
    const defaults = this.config.defaults || {};
    const settleMs = defaults.verifySettleMs ?? 2000;
    const pollIntervalMs = defaults.verifyPollIntervalMs ?? 500;
    const timeoutMs = defaults.verifyTimeoutMs ?? 20000;

    const targetSuccessUrl = this.config.urls.baseUrl;

    // Let the click be processed before judging the page, so an alert that was
    // already on the form is not mistaken for a response to this submission.
    await delay(settleMs);

    const deadline = Date.now() + timeoutMs;
    const seenAlertTexts = [];
    let currentUrl = this.page.url();
    let pageTitle = await this.page.title();

    while (true) {
      currentUrl = this.page.url();
      pageTitle = await this.page.title();

      const foundAlerts = await this.extractPageAlerts();

      // Toasts disappear between polls, so remember everything seen for the
      // failure message rather than only what is visible at the end.
      for (const alert of foundAlerts) {
        if (!seenAlertTexts.includes(alert.text)) {
          seenAlertTexts.push(alert.text);
        }
      }

      // Check 1: A recognised failure always takes precedence over URL-based
      // success. An unrecognised banner scores below the threshold and is left
      // to the checks below rather than failing the booking on its own.
      const { bestCandidate, highestScore } = rankBookingAlerts(foundAlerts);
      if (bestCandidate && highestScore >= FATAL_ALERT_SCORE) {
        log(`Booking failed. Detected webpage error message: "${bestCandidate}"`);
        throw this.createBookingError(bestCandidate, currentUrl, pageTitle);
      }

      // Check 2: Skedda confirms with a banner reading
      // "Too easy - your booking is confirmed." That is definitive success.
      const successMessage = foundAlerts.map(alert => alert.text).find(isBookingSuccessMessage);
      if (successMessage) {
        log(`Success evidence: confirmation message: "${successMessage}"`);
        log(`Success evidence: page title: "${pageTitle}"`);
        return true;
      }

      // Check 3: The booking form parameters disappear after a successful
      // submit and the browser is on the expected tenant.
      if (isBookingSuccessUrl(targetSuccessUrl, currentUrl)) {
        log(`Success evidence: completed booking URL: ${currentUrl}`);
        log(`Success evidence: page title: "${pageTitle}"`);
        log('Success evidence: no critical booking error is visible');
        return true;
      }

      if (Date.now() >= deadline) break;

      await delay(pollIntervalMs);
    }

    // Check 4: No confirmation, no recognised error, and never reached the
    // success URL within the timeout.
    log(`URL check did not indicate success within ${timeoutMs}ms. Current URL: ${currentUrl}.`);

    if (seenAlertTexts.length > 0) {
      log(`Found non-critical alerts but no confirmation: ${seenAlertTexts.join(' | ')}`);
    }

    const visibleAlerts = seenAlertTexts.length > 0 ? ` Alerts seen while waiting: ${seenAlertTexts.join(' | ')}.` : '';
    const genericFailureMessage = `Booking failed: Did not reach a completed booking URL based on ${targetSuccessUrl} and no confirmation message was found within ${timeoutMs}ms.${visibleAlerts} Current URL: ${currentUrl}, Page Title: "${pageTitle}"`;
    log(genericFailureMessage);
    throw this.createBookingError(genericFailureMessage, currentUrl, pageTitle);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      log('Browser closed');
    }
  }

  async book(options) {
    const {
      facility,
      date, // Date is expected in YYYY-MM-DD format, already calculated if --book-in-advance-days was used.
      startTime,
      endTime,
      signature = this.config.defaults.signature,
      customTitle = null,
      headless = this.config.defaults.headless
    } = options;

    try {
      await this.initialize(headless);

      const bookingUrl = generateBookingUrl({
        baseUrl: this.config.urls.baseUrl,
        spaceId: facility.spaceId,
        date,
        startTime,
        endTime
      });

      const bookingTitle = customTitle || formatBookingTitle(
        startTime,
        endTime,
        this.config.defaults.bufferMinutes
      );

      log(`Booking details: ${facility.name} on ${date} from ${startTime} to ${endTime}`);

      await this.navigateAndLogin(bookingUrl);
      await this.fillBookingForm(bookingTitle, signature);
      await this.submitBooking();

      log('Booking process completed successfully!');

    } catch (error) {
      log(`Booking failed: ${error.message}`);
      log(`Error details: ${error.stack || 'No stack trace available'}`);

      // Log additional context if available
      if (this.page) {
        try {
          const url = this.page.url();
          const title = await this.page.title();
          log(`Error occurred on page: ${url}`);
          log(`Page title: ${title}`);
        } catch (pageError) {
          log(`Could not retrieve page information: ${pageError.message}`);
        }
      }

      throw error;
    } finally {
      await this.close();
    }
  }
}

module.exports = BookingAutomator;

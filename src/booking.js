const puppeteer = require('puppeteer');
const { formatBookingTitle, generateBookingUrl, delay, log } = require('./utils');

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

    for (const selector of titleSelectors) {
      const element = await this.page.$(selector);
      if (element) {
        await element.click({ clickCount: 3 });
        await element.type(bookingTitle);
        log(`Booking title filled: ${bookingTitle}`);
        break;
      }
    }

    const signatureSelectors = [
      'input[name*="signature"]',
      'input[placeholder*="signature"]',
      'input[placeholder*="initial"]',
      '#signature',
      '.signature input'
    ];

    for (const selector of signatureSelectors) {
      const element = await this.page.$(selector);
      if (element) {
        await element.click({ clickCount: 3 });
        await element.type(signature);
        log(`Signature filled: ${signature}`);
        break;
      }
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

  async verifyBookingSuccess() {
    log('Verifying booking success...');
    // Wait for potential navigation or dynamic content loading after submission.
    // The primary success indicator is redirection to the base booking URL without query parameters.
    await delay(5000); // Wait for redirects or for error messages to appear.

    const targetSuccessUrl = 'https://parkhurst.skedda.com/booking';
    const currentUrl = this.page.url();

    // Check 1: Exact URL match for success.
    // If the current URL is exactly the target success URL, the booking was successful.
    if (currentUrl === targetSuccessUrl) {
      log(`Success: Navigated to the target success URL: ${currentUrl}`);
      return true;
    }

    // If not redirected to the exact success URL, it's considered a failure or an error state.
    // Log this intermediate state before checking for specific error messages.
    log(`URL check failed: Not redirected to exact success URL. Current URL: ${currentUrl}. Proceeding to check for error messages.`);

    // Check 2: Look for specific error messages on the page.
    const errorSelectors = [
      '.alert-danger',      // Bootstrap danger alert
      '.error-message',     // Common class for error messages
      '.booking-error',     // Custom or specific booking error class
      '[class*="error"]',   // Elements with 'error' in their class name
      '.alert',             // General alert (could be info/warning, but check content)
      '[role="alert"]'      // ARIA role for alerts
    ];

    const foundErrors = [];

    for (const selector of errorSelectors) {
      const elements = await this.page.$$(selector);
      for (const element of elements) {
        try {
          const isVisible = await element.isIntersectingViewport();
          if (isVisible) {
            const text = await element.evaluate(el => el.textContent.trim());
            if (text && text.length > 0) {
              foundErrors.push(text);
            }
          }
        } catch (err) {
          log(`Error while checking selector ${selector} for error messages: ${err.message}`, 'warn');
        }
      }
    }

    if (foundErrors.length > 0) {
      // Prioritize identifying the "real" error over informational messages.
      // High priority keywords indicating a hard failure or refusal.
      const highPriorityKeywords = [
        'cannot', "can't", "couldn't",
        'quota', 'exceeded',
        'failed', 'error',
        'confirmed because', // "This booking cannot be confirmed because..."
        'not allowed',
        'conflict'
      ];

      // Low priority/informational keywords to possibly ignore if they are the only thing found
      const lowPriorityKeywords = [
        'verified', 'residents', 'info', 'note'
      ];

      // Find the "worst" error
      let bestCandidate = null;
      let highestScore = -1;

      for (const errorText of foundErrors) {
        const lowerText = errorText.toLowerCase();
        let score = 0;

        // Check high priority keywords
        if (highPriorityKeywords.some(kw => lowerText.includes(kw))) {
          score = 10;
        }
        // Check if it looks like the generic info banner
        else if (lowPriorityKeywords.some(kw => lowerText.includes(kw))) {
          score = 1;
        } else {
          score = 5; // Unknown alert, assume it might be important
        }

        if (score > highestScore) {
          highestScore = score;
          bestCandidate = errorText;
        }
      }

      // If the highest score is low (meaning we only found info banners), 
      // check if we are still on the booking page. 
      // If we ARE still on the booking page (implied by this method being called),
      // and we haven't seen a high priority error, but we DID find alerts...
      // logic: if we found a verified resident banner, that doesn't mean failure by itself.
      // But if we are stuck on this page and not redirected, something IS wrong.
      // However, usually "Quota Exceeded" shows up.

      if (bestCandidate && highestScore >= 5) {
        const errorMessage = `Booking failed. Detected error message: "${bestCandidate}"`;
        log(errorMessage);
        throw new Error(errorMessage);
      } else {
        log(`Found informational alerts but no critical errors: ${foundErrors.join(' | ')}. Continuing checks...`);
      }
    }

    // Check 3: If no specific error message is found, but not on success URL, log current state as a generic failure.
    const pageTitle = await this.page.title();
    const genericFailureMessage = `Booking failed: Did not redirect to success URL (${targetSuccessUrl}) and no specific error messages were found. Current URL: ${currentUrl}, Page Title: "${pageTitle}"`;
    log(genericFailureMessage);
    throw new Error(genericFailureMessage);
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
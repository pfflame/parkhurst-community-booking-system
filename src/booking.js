const puppeteer = require('puppeteer');
const { formatBookingTitle, generateBookingUrl, delay, log } = require('./utils');

class BookingAutomator {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async initialize(headless = true) {
    log('Initializing browser...');
    this.browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
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
    
    await delay(2000);
    await this.handlePostSubmissionDialogs();
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

  async logErrorToFile(errorMessage) {
    const fs = require('fs').promises;
    const path = require('path');
    const logFilePath = path.join(process.cwd(), 'booking_errors.log');
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp} - ${errorMessage}\n`;
    try {
      await fs.appendFile(logFilePath, logMessage);
      log(`Error logged to ${logFilePath}`);
    } catch (err) {
      log(`Failed to write to log file: ${err.message}`);
    }
  }

  async verifyBookingSuccess() {
    log('Verifying booking success...');
    // Wait for potential navigation or dynamic content loading after submission.
    // The confirmation message is transient, so primary check is URL.
    await delay(5000); // Increased delay to allow for redirect

    const targetSuccessUrl = 'https://parkhurst.skedda.com/booking';
    const currentUrl = this.page.url();

    // Success is when the URL is *exactly* the target landing page URL, without any query parameters.
    if (currentUrl === targetSuccessUrl) {
      log(`Success detected: Navigated to ${currentUrl}`);
      return true;
    }

    // If not redirected to the exact success URL, it's considered a failure or an error state.
    log(`Not redirected to exact success URL. Current URL: ${currentUrl}. Checking for errors or staying on booking form.`);

    const successMessageText = 'Too easy...your booking is in! A confirmation email will hit your inbox shortly.';
    const errorSelectors = [
      '.alert-danger',
      '.error-message',
      '.booking-error',
      '[class*="error"]',
      '.alert',
      '[role="alert"]'
    ];

    let errorMessage = 'Booking failed: Did not redirect to success URL and no specific error message found.';
    let errorDetected = false;

    for (const selector of errorSelectors) {
      const elements = await this.page.$$(selector);
      for (const element of elements) {
        try {
          const isVisible = await element.isIntersectingViewport();
          if (isVisible) {
            const text = await element.evaluate(el => el.textContent.trim());
            // Avoid logging the transient success message as an error if it's styled as an alert
            if (text && !text.includes(successMessageText)) { 
              errorMessage = `Booking failed: ${text}`;
              log(errorMessage);
              await this.logErrorToFile(errorMessage);
              errorDetected = true;
              break;
            }
          }
        } catch (err) {
          log(`Error while checking selector ${selector}: ${err.message}`);
        }
      }
      if (errorDetected) break;
    }

    if (errorDetected) {
      throw new Error(errorMessage);
    }

    // If no specific error message is found, but not on success URL, log current state and throw error.
    const pageTitle = await this.page.title();
    const genericError = `Booking status unclear. Not on success URL. Current URL: ${currentUrl}, Page Title: ${pageTitle}`;
    log(genericError);
    await this.logErrorToFile(genericError);
    throw new Error(genericError);
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
      date,
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
// Skedda/AllBooked renders confirmations, informational notices and failures in
// the same Bootstrap alert markup ([role="alert"]), so the presence of a visible
// alert is not by itself evidence that the booking failed. The confirmation
// banner reads "Too easy - your booking is confirmed." and was previously
// classified as an unrecognised error, which failed a booking that had actually
// been made. These helpers classify alert text so that only a recognised failure
// is treated as fatal.

const SUCCESS_PHRASES = [
  'your booking is confirmed',
  'booking is confirmed',
  'booking has been confirmed'
];

const HIGH_PRIORITY_KEYWORDS = [
  'cannot', "can't", "couldn't",
  'quota', 'exceeded',
  'failed', 'error',
  'confirmed because',
  'not allowed',
  'conflict'
];

const LOW_PRIORITY_KEYWORDS = [
  'verified', 'residents', 'info', 'note'
];

// An alert is only treated as a failure at FATAL_ALERT_SCORE or above. An
// unrecognised banner scores below the threshold so the URL check decides.
const SCORE_KEYWORD_ERROR = 10;  // matched a known failure keyword
const SCORE_DANGER_ELEMENT = 7;  // no keyword, but rendered as a danger alert
const SCORE_UNRECOGNIZED = 5;    // unknown banner - defer to the URL check
const SCORE_INFORMATIONAL = 1;   // known informational banner

const FATAL_ALERT_SCORE = 7;

function normalizeAlertText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/**
 * True when the alert text is the booking confirmation banner. A failure
 * keyword always wins, so "This booking cannot be confirmed because..." is
 * never read as a confirmation.
 */
function isBookingSuccessMessage(text) {
  const lowerText = normalizeAlertText(text).toLowerCase();

  if (!lowerText) return false;
  if (HIGH_PRIORITY_KEYWORDS.some(keyword => lowerText.includes(keyword))) return false;

  return SUCCESS_PHRASES.some(phrase => lowerText.includes(phrase));
}

function scoreAlert(alert) {
  const lowerText = normalizeAlertText(alert.text).toLowerCase();

  // Checked first so a confirmation is never fatal, even if the site renders it
  // inside a danger-styled wrapper. Safe because isBookingSuccessMessage()
  // rejects any text carrying a failure keyword ("cannot be confirmed because").
  if (isBookingSuccessMessage(alert.text)) {
    return SCORE_INFORMATIONAL;
  }

  if (HIGH_PRIORITY_KEYWORDS.some(keyword => lowerText.includes(keyword))) {
    return SCORE_KEYWORD_ERROR;
  }

  // Checked before the informational keywords so a danger-styled alert is never
  // downgraded just because it happens to contain a word like "verified".
  if (alert.isDanger) {
    return SCORE_DANGER_ELEMENT;
  }

  if (LOW_PRIORITY_KEYWORDS.some(keyword => lowerText.includes(keyword))) {
    return SCORE_INFORMATIONAL;
  }

  return SCORE_UNRECOGNIZED;
}

/**
 * Picks the most likely failure message from the visible alerts.
 * Accepts { text, isDanger } entries as collected from the page.
 */
function rankBookingAlerts(alerts) {
  let bestCandidate = null;
  let highestScore = -1;

  for (const alert of alerts) {
    const score = scoreAlert(alert);

    if (score > highestScore) {
      highestScore = score;
      bestCandidate = normalizeAlertText(alert.text);
    }
  }

  return { bestCandidate, highestScore };
}

module.exports = {
  FATAL_ALERT_SCORE,
  isBookingSuccessMessage,
  rankBookingAlerts
};

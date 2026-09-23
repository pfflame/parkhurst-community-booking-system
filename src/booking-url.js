function isBookingSuccessUrl(configuredBaseUrl, currentUrl) {
  try {
    const configuredBookingUrl = new URL(configuredBaseUrl);
    const actualUrl = new URL(currentUrl);
    const bookingParameters = ['nbstart', 'nbend', 'nbspaces'];
    const tenant = configuredBookingUrl.hostname.split('.')[0];
    const allowedHostnames = new Set([
      configuredBookingUrl.hostname,
      `${tenant}.skedda.com`,
      `${tenant}.allbooked.com`
    ]);

    return actualUrl.protocol === configuredBookingUrl.protocol &&
      allowedHostnames.has(actualUrl.hostname) &&
      actualUrl.pathname.replace(/\/+$/, '') === configuredBookingUrl.pathname.replace(/\/+$/, '') &&
      !bookingParameters.some(parameter => actualUrl.searchParams.has(parameter));
  } catch (error) {
    return false;
  }
}

module.exports = { isBookingSuccessUrl };

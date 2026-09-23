const fs = require('fs');
const path = require('path');
/** Load shared settings plus an explicitly selected login. */
function loadConfig(configPath = null, options = {}) {
  const finalConfigPath = configPath || path.join(__dirname, '..', 'config', 'config.json');
  let config;
  try {
    config = JSON.parse(fs.readFileSync(finalConfigPath, 'utf8'));
  } catch (_) {
    throw new Error('Cannot read config file; check its path and JSON format');
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Shared configuration must be a JSON object');
  }
  // Logins belong only to the selected user, never to shared settings or env fallbacks.
  delete config.credentials;
  let credentials;
  const hasDirect = options.email !== undefined || options.password !== undefined;
  if (options.credentials) {
    if (hasDirect) {
      throw new Error('Use --credentials by itself, without --email or --password');
    }
    try {
      const filename = path.resolve(__dirname, '..', options.credentials);
      credentials = JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (_) {
      throw new Error('Cannot read credentials file; check its path and JSON format');
    }
    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials) ||
        Object.keys(credentials).some(key => !['email', 'password'].includes(key))) {
      throw new Error('Credentials file must contain only email and password');
    }
  } else if (hasDirect) {
    credentials = { email: options.email, password: options.password };
  }
  if (credentials) {
    if (typeof credentials.email !== 'string' || !credentials.email.trim() ||
        typeof credentials.password !== 'string' || !credentials.password) {
      throw new Error('Provide both email and password; neither may be empty');
    }
    config.credentials = { email: credentials.email.trim(), password: credentials.password };
  }
  return config;
}

/**
 * Validates configuration object
 */
function validateConfig(config, { requireCredentials = true } = {}) {
  if (!config.defaults) {
    throw new Error('Missing defaults section in config');
  }
  if (config.defaults.bookInAdvanceDays !== undefined &&
    (typeof config.defaults.bookInAdvanceDays !== 'number' || config.defaults.bookInAdvanceDays < 0)) {
    throw new Error('config.defaults.bookInAdvanceDays must be a non-negative number if provided');
  }

  if (!config.facilities) {
    throw new Error('Missing facilities section in config');
  }

  if (!config.urls) {
    throw new Error('Missing urls section in config');
  }

  if (requireCredentials) {
    if (!config.credentials) {
      throw new Error('Choose a user with --credentials config/users/NAME.json');
    }
    if (!config.credentials.email || !config.credentials.password) {
      throw new Error('Provide both email and password; neither may be empty');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(config.credentials.email)) {
      throw new Error('Invalid email format in credentials');
    }
  }

  if (!config.urls.baseUrl) {
    throw new Error('Missing baseUrl in urls section');
  }

  if (Object.keys(config.facilities).length === 0) {
    throw new Error('No facilities defined in config');
  }

  for (const [facilityKey, facility] of Object.entries(config.facilities)) {
    if (!facility.spaceId) {
      throw new Error(`Missing spaceId for facility: ${facilityKey}`);
    }

    if (!facility.name) {
      throw new Error(`Missing name for facility: ${facilityKey}`);
    }
  }
}

/**
 * Gets facility configuration by key
 */
function getFacility(config, facilityKey) {
  const facility = config.facilities[facilityKey];

  if (!facility) {
    return null;
  }

  return facility;
}

/**
 * Lists all available facilities
 */
function listFacilities(config) {
  return Object.entries(config.facilities).map(([key, facility]) => ({
    key,
    ...facility
  }));
}

module.exports = {
  loadConfig,
  validateConfig,
  getFacility,
  listFacilities
};
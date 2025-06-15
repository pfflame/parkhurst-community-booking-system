const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Loads profile credentials from environment variables
 */
function loadProfileCredentials(profileEmail) {
  // Look for profile-specific environment variables
  const profileKey = profileEmail.replace(/[@.]/g, '_').toUpperCase();
  const usernameKey = `PROFILE_${profileKey}_USERNAME`;
  const passwordKey = `PROFILE_${profileKey}_PASSWORD`;
  const signatureKey = `PROFILE_${profileKey}_SIGNATURE`;
  
  const username = process.env[usernameKey];
  const password = process.env[passwordKey];
  const signature = process.env[signatureKey];
  
  if (!username) {
    throw new Error(`Username not found for profile ${profileEmail}. Expected environment variable: ${usernameKey}`);
  }
  
  if (!password) {
    throw new Error(`Password not found for profile ${profileEmail}. Expected environment variable: ${passwordKey}`);
  }
  
  return {
    email: username,
    password: password,
    signature: signature || null
  };
}

/**
 * Loads configuration from file or environment variables
 */
function loadConfig(configPath = null, profileEmail = null) {
  const defaultConfigPath = path.join(__dirname, '..', 'config', 'config.json');
  const finalConfigPath = configPath || defaultConfigPath;
  
  let config = {};
  
  if (fs.existsSync(finalConfigPath)) {
    try {
      const configData = fs.readFileSync(finalConfigPath, 'utf8');
      config = JSON.parse(configData);
    } catch (error) {
      throw new Error(`Failed to parse config file: ${error.message}`);
    }
  } else {
    throw new Error(`Config file not found: ${finalConfigPath}`);
  }
  
  // If profile email is provided, load profile-specific credentials
  if (profileEmail) {
    const profileCredentials = loadProfileCredentials(profileEmail);
    config.credentials.email = profileCredentials.email;
    config.credentials.password = profileCredentials.password;
    if (profileCredentials.signature) {
      config.defaults.signature = profileCredentials.signature;
    }
  } else {
    // Override with default environment variables if available
    if (process.env.BOOKING_EMAIL) {
      config.credentials.email = process.env.BOOKING_EMAIL;
    }
    
    if (process.env.BOOKING_PASSWORD) {
      config.credentials.password = process.env.BOOKING_PASSWORD;
    }
    
    if (process.env.BOOKING_SIGNATURE) {
      config.defaults.signature = process.env.BOOKING_SIGNATURE;
    }
  }
  
  return config;
}

/**
 * Validates configuration object
 */
function validateConfig(config) {
  if (!config.defaults) {
    throw new Error('Missing defaults section in config');
  }
  if (config.defaults.bookInAdvanceDays !== undefined && 
      (typeof config.defaults.bookInAdvanceDays !== 'number' || config.defaults.bookInAdvanceDays < 0)) {
    throw new Error('config.defaults.bookInAdvanceDays must be a non-negative number if provided');
  }

  if (!config.credentials) {
    throw new Error('Missing credentials section in config');
  }
  
  if (!config.facilities) {
    throw new Error('Missing facilities section in config');
  }
  
  if (!config.urls) {
    throw new Error('Missing urls section in config');
  }
  
  if (!config.credentials.email) {
    throw new Error('Missing email in credentials');
  }
  
  if (!config.credentials.password) {
    throw new Error('Missing password in credentials');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(config.credentials.email)) {
    throw new Error('Invalid email format in credentials');
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
    const availableFacilities = Object.keys(config.facilities).join(', ');
    throw new Error(`Facility '${facilityKey}' not found. Available facilities: ${availableFacilities}`);
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

/**
 * Creates a sample config file
 */
function createSampleConfig(outputPath) {
  const sampleConfig = {
    credentials: {
      email: "your-email@example.com",
      password: "your-password"
    },
    defaults: {
      signature: "ZZ",
      bufferMinutes: 15,
      headless: true,
      bookInAdvanceDays: 15, // Default days to book in advance
      timeout: 30000
    },
    facilities: {
      tennis_lower: {
        spaceId: "1244466",
        name: "Tennis - Lower Court Whole"
      }
    },
    urls: {
      baseUrl: "https://parkhurst.skedda.com/booking",
      loginUrl: "https://parkhurst.skedda.com/login"
    }
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(sampleConfig, null, 2));
}

module.exports = {
  loadConfig,
  loadProfileCredentials,
  validateConfig,
  getFacility,
  listFacilities,
  createSampleConfig
};
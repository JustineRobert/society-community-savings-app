/**
 * Artillery Processor
 * ============================================================================
 * Helper functions for Artillery load testing
 */

// Generate random email
function randomEmail() {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@example.com`;
}

// Setup variables before each scenario
function setup(context, ee, next) {
  context.vars.authEmail = randomEmail();
  context.vars.timestamp = Date.now();
  return next();
}

// Teardown after each scenario
function teardown(context, ee, next) {
  return next();
}

// Custom function to generate phone number
function phoneNumber(context, events, done) {
  const prefix = '+254';
  const number = Math.floor(Math.random() * 9000000000) + 1000000000;
  context.vars.phone = prefix + number.toString();
  return done();
}

// Custom function to extract auth token
function extractAuthToken(requestParams, context, ee, next) {
  if (requestParams.json && requestParams.json.token) {
    context.vars.authToken = requestParams.json.token;
  }
  return next();
}

// Logging function
function beforeRequest(requestParams, context, ee, next) {
  const method = requestParams.method || 'GET';
  const url = requestParams.url;
  
  console.log(`[${new Date().toISOString()}] ${method} ${url}`);
  
  return next();
}

// Error handler
function afterResponse(requestParams, response, context, ee, next) {
  if (response.statusCode >= 400) {
    console.error(`[${new Date().toISOString()}] Error: ${response.statusCode} on ${requestParams.url}`);
  }
  return next();
}

module.exports = {
  setup,
  teardown,
  phoneNumber,
  extractAuthToken,
  beforeRequest,
  afterResponse
};

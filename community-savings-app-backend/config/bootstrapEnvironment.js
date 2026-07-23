/**
 * --------------------------------------------------------------------------
 * Environment Bootstrap
 * Enterprise Runtime Validation
 * --------------------------------------------------------------------------
 */

require("dotenv").config();

const REQUIRED_ENV_VARS = [
  "NODE_ENV",
  "PORT",
  "JWT_SECRET",
];

function validateNodeEnvironment() {
  const allowed = [
    "development",
    "test",
    "staging",
    "production",
  ];

  if (!allowed.includes(process.env.NODE_ENV)) {
    throw new Error(
      `Invalid NODE_ENV: ${process.env.NODE_ENV}`
    );
  }
}

function bootstrapEnvironment() {
  const missing = REQUIRED_ENV_VARS.filter(
    (variable) => !process.env[variable]
  );

  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  validateNodeEnvironment();

  if (!process.env.MONGODB_URI) {
    console.warn(
      "[WARNING] MONGODB_URI not configured"
    );
  }

  console.log(
    `✅ Environment validated (${process.env.NODE_ENV})`
  );
}

module.exports = bootstrapEnvironment;
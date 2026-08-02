"use strict";

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const bootstrapEnvironment = require("./config/bootstrapEnvironment");
const { bootstrapResilienceObservability } = require("./observability/resilienceObservabilityBootstrap");
const { bootstrapResilience } = require("./middleware/resilience/bootstrap");

const observability = bootstrapResilienceObservability({
  serviceName: process.env.SERVICE_NAME || "community-savings-backend",
});

const logger = observability?.logger || console;

function validateRuntime() {
  const minimumNodeMajor = 22;
  const nodeMajor = Number(process.versions.node.split(".")[0]);

  if (Number.isNaN(nodeMajor) || nodeMajor < minimumNodeMajor) {
    throw new Error(`Node.js ${minimumNodeMajor}+ required. Current: ${process.version}`);
  }

  if (!["linux", "darwin", "win32"].includes(process.platform)) {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }

  if (!["x64", "arm64"].includes(process.arch)) {
    throw new Error(`Unsupported architecture: ${process.arch}`);
  }

  if (!crypto.randomUUID || !global.structuredClone || !global.fetch || !global.AbortController || !global.URLPattern) {
    throw new Error("Required runtime features are unavailable.");
  }
}

async function startServer() {
  try {
    console.log("?? Starting Community Savings Backend...");

    validateRuntime();
    bootstrapEnvironment();

    await bootstrapResilience({ logger });

    const app = require("./app");
    const port = Number(process.env.PORT) || 5000;

    const server = app.listen(port, () => {
      console.log(`✅ Server running on port ${port}`);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`?? ${signal} received. Beginning graceful shutdown...`);
      server.close(() => {
        console.log("? HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);

    return server;
  } catch (error) {
    console.error("? Application startup failed");
    console.error(error);
    process.exit(1);
  }
}

startServer();

module.exports = { startServer, validateRuntime };
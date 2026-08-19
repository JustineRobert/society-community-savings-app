"use strict";

/**
 * =============================================================================
 * TITech Community Capital LTD
 * ACFOS
 *
 * File: backend/config/env.js
 * =============================================================================
 *
 * Central environment bootstrap.
 *
 * IMPORTANT:
 * This module must be loaded before modules that depend on environment
 * variables.
 * =============================================================================
 */

const path = require("path");
const dotenv = require("dotenv");

const ENV_FILE = process.env.ENV_FILE
    ? path.resolve(process.cwd(), process.env.ENV_FILE)
    : path.resolve(process.cwd(), ".env");

dotenv.config({
    path: ENV_FILE,
    override: false
});

function getEnv(name, fallback = undefined) {
    const value = process.env[name];

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    return value;
}

function getBoolean(name, fallback = false) {

    const value = getEnv(name);

    if (value === undefined) {
        return fallback;
    }

    return [
        "true",
        "1",
        "yes",
        "on"
    ].includes(
        String(value).toLowerCase()
    );
}

function getNumber(name, fallback) {

    const value = getEnv(name);

    if (value === undefined) {
        return fallback;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed)
        ? parsed
        : fallback;
}

module.exports = Object.freeze({

    file: ENV_FILE,

    getEnv,
    getBoolean,
    getNumber

});
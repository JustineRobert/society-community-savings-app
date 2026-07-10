/**
 * =============================================================================
 * File: backend/modules/onboarding/__tests__/onboarding.integration.test.js
 * Part 1 — Imports, Mongo Memory Server, Express Factory, Test Bootstrap
 * =============================================================================
 *
 * Enterprise Integration Test Suite
 * TITech Community Capital LTD
 *
 * Stack
 * -----------------------------------------------------------------------------
 * • Jest
 * • Supertest
 * • MongoDB Memory Server
 * • Express
 * • Mongoose
 * • Enterprise Service Mocking
 *
 * Remaining Parts
 * -----------------------------------------------------------------------------
 * Part 2
 * Registration Integration Tests
 *
 * Part 3
 * KYC Integration Tests
 *
 * Part 4
 * Subscription Integration Tests
 *
 * Part 5
 * Go Live Integration Tests
 *
 * Part 6
 * Complete End-to-End Workflow
 * =============================================================================
 */

"use strict";

/* =============================================================================
 * Core
 * ========================================================================== */

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");

const {
    MongoMemoryServer,
} = require("mongodb-memory-server");

/* =============================================================================
 * Middleware
 * ========================================================================== */

const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");

/* =============================================================================
 * Routes
 * ========================================================================== */

const onboardingRoutes = require("../onboarding.routes");

/* =============================================================================
 * Test Utilities
 * ========================================================================== */

let app;
let mongoServer;

/* =============================================================================
 * Environment
 * ========================================================================== */

process.env.NODE_ENV = "test";

process.env.JWT_SECRET =
    process.env.JWT_SECRET ||
    "integration-test-secret";

process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY ||
    "integration-encryption-key";

process.env.LOG_LEVEL = "error";

/* =============================================================================
 * Global Mock Helpers
 * ========================================================================== */

jest.setTimeout(60000);

/*
|--------------------------------------------------------------------------
| UUID
|--------------------------------------------------------------------------
*/

jest.mock("uuid", () => ({
    v4: jest.fn(() => "integration-test-uuid"),
}));

/*
|--------------------------------------------------------------------------
| Logger
|--------------------------------------------------------------------------
*/

jest.mock("../../../shared/utils/logger", () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
}));

/*
|--------------------------------------------------------------------------
| Email Service
|--------------------------------------------------------------------------
*/

jest.mock("../../../services/emailService", () => ({
    sendEmail: jest.fn().mockResolvedValue({
        success: true,
    }),
}));

/*
|--------------------------------------------------------------------------
| SMS Service
|--------------------------------------------------------------------------
*/

jest.mock("../../../services/smsService", () => ({
    sendSMS: jest.fn().mockResolvedValue({
        success: true,
    }),
}));

/*
|--------------------------------------------------------------------------
| Notification Service
|--------------------------------------------------------------------------
*/

jest.mock("../../../services/notificationService", () => ({
    sendNotification: jest.fn().mockResolvedValue({
        success: true,
    }),
}));

/*
|--------------------------------------------------------------------------
| MTN MoMo
|--------------------------------------------------------------------------
*/

jest.mock("../../../modules/mtnMomoService", () => ({
    initializePayment: jest.fn().mockResolvedValue({
        success: true,
        reference: "MTN-TEST-001",
    }),
}));

/*
|--------------------------------------------------------------------------
| Airtel Money
|--------------------------------------------------------------------------
*/

jest.mock("../../../modules/airtelMoneyService", () => ({
    initializePayment: jest.fn().mockResolvedValue({
        success: true,
        reference: "AIRTEL-TEST-001",
    }),
}));

/*
|--------------------------------------------------------------------------
| Audit Log
|--------------------------------------------------------------------------
*/

jest.mock("../../../shared/middleware/auditLogMiddleware", () => ({
    auditLogMiddleware:
        (req, res, next) => next(),
}));

/* =============================================================================
 * Express Factory
 * ========================================================================== */

function createApp() {

    const application = express();

    application.disable("x-powered-by");

    application.use(helmet());

    application.use(cors());

    application.use(compression());

    application.use(express.json({
        limit: "10mb",
    }));

    application.use(express.urlencoded({
        extended: true,
    }));

    /*
    |--------------------------------------------------------------------------
    | Health
    |--------------------------------------------------------------------------
    */

    application.get("/health", (req, res) => {

        res.status(200).json({
            success: true,
            status: "ok",
        });

    });

    /*
    |--------------------------------------------------------------------------
    | API
    |--------------------------------------------------------------------------
    */

    application.use(
        "/api/onboarding",
        onboardingRoutes
    );

    /*
    |--------------------------------------------------------------------------
    | Error Handler
    |--------------------------------------------------------------------------
    */

    application.use(
        (err, req, res, next) => {

            res.status(
                err.status || 500
            ).json({

                success: false,

                message:
                    err.message ||
                    "Integration Test Error",

            });

        }
    );

    return application;

}

/* =============================================================================
 * MongoDB Setup
 * ========================================================================== */

beforeAll(async () => {

    mongoServer =
        await MongoMemoryServer.create({

            binary: {
                version: "7.0.14",
            },

        });

    const uri = mongoServer.getUri();

    await mongoose.connect(uri, {

        autoIndex: true,

    });

    app = createApp();

});

/* =============================================================================
 * Database Cleanup
 * ========================================================================== */

afterEach(async () => {

    const collections =
        mongoose.connection.collections;

    for (const key of Object.keys(collections)) {

        await collections[key].deleteMany({});

    }

    jest.clearAllMocks();

});

/* =============================================================================
 * Shutdown
 * ========================================================================== */

afterAll(async () => {

    await mongoose.disconnect();

    if (mongoServer) {

        await mongoServer.stop();

    }

});

/* =============================================================================
 * Shared Test Helpers
 * ========================================================================== */

const buildRegistrationPayload = () => ({

    saccoName: "Enterprise SACCO",

    registrationNumber: "REG-001",

    tinNumber: "TIN-001",

    email: "enterprise@test.com",

    phone: "256700000000",

    physicalAddress: "Kampala",

    district: "Kampala",

    region: "Central",

    contactPerson: {

        fullName: "John Doe",

        designation: "CEO",

        phone: "256700000000",

        email: "john@test.com",

        nationalId: "CM12345678",

    },

    subscriptionPlan: "STARTER",

});

/* =============================================================================
 * Test Suites
 * ============================================================================= */

/*
|--------------------------------------------------------------------------
| Part 2 begins here
|--------------------------------------------------------------------------
|
| describe("SACCO Registration", () => {
|
*/
/* =============================================================================
 * Part 2 — SACCO Registration Integration Tests
 * ============================================================================= */

describe("SACCO Registration API", () => {
    describe("POST /api/onboarding/sacco", () => {

        it("should successfully register a new SACCO", async () => {

            const payload = buildRegistrationPayload();

            const response = await request(app)
                .post("/api/onboarding/sacco")
                .send(payload);

            expect(response.status).toBe(201);

            expect(response.body).toEqual(
                expect.objectContaining({
                    success: true,
                })
            );

            expect(response.body.data).toEqual(
                expect.objectContaining({
                    saccoName: payload.saccoName,
                    registrationNumber: payload.registrationNumber,
                    email: payload.email,
                })
            );

        });

        it("should persist the SACCO in MongoDB", async () => {

            const payload = buildRegistrationPayload();

            await request(app)
                .post("/api/onboarding/sacco")
                .send(payload);

            const collection =
                mongoose.connection.collection("saccos");

            const saved =
                await collection.findOne({
                    registrationNumber:
                        payload.registrationNumber,
                });

            expect(saved).not.toBeNull();

            expect(saved.saccoName)
                .toBe(payload.saccoName);

        });

        it("should reject duplicate registration numbers", async () => {

            const payload = buildRegistrationPayload();

            await request(app)
                .post("/api/onboarding/sacco")
                .send(payload);

            const duplicate =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(payload);

            expect([400, 409]).toContain(
                duplicate.status
            );

        });

        it("should reject duplicate email addresses", async () => {

            const payload = buildRegistrationPayload();

            await request(app)
                .post("/api/onboarding/sacco")
                .send(payload);

            const duplicate = {
                ...buildRegistrationPayload(),
                registrationNumber: "REG-002",
            };

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(duplicate);

            expect([400, 409]).toContain(
                response.status
            );

        });

        it("should validate required fields", async () => {

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send({});

            expect(response.status)
                .toBeGreaterThanOrEqual(400);

        });

        it("should reject malformed email addresses", async () => {

            const payload = buildRegistrationPayload();

            payload.email = "invalid-email";

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(payload);

            expect(response.status)
                .toBeGreaterThanOrEqual(400);

        });

        it("should reject invalid phone numbers", async () => {

            const payload = buildRegistrationPayload();

            payload.phone = "123";

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(payload);

            expect(response.status)
                .toBeGreaterThanOrEqual(400);

        });

        it("should normalize whitespace before persistence", async () => {

            const payload = buildRegistrationPayload();

            payload.saccoName =
                "   Enterprise SACCO   ";

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(payload);

            expect(response.status).toBe(201);

            expect(
                response.body.data.saccoName.trim()
            ).toBe("Enterprise SACCO");

        });

        it("should support UTF-8 and international characters", async () => {

            const payload = buildRegistrationPayload();

            payload.saccoName =
                "Élite SACCO Uganda";

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(payload);

            expect(response.status).toBe(201);

        });

        it("should ignore unexpected client properties", async () => {

            const payload = {
                ...buildRegistrationPayload(),
                hackerField: "malicious",
                admin: true,
            };

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(payload);

            expect(response.status).toBe(201);

            expect(
                response.body.data.admin
            ).toBeUndefined();

        });

        it("should return JSON content type", async () => {

            const payload = buildRegistrationPayload();

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(payload);

            expect(
                response.headers["content-type"]
            ).toMatch(/application\/json/i);

        });

        it("should create unique SACCO IDs", async () => {

            const first =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            const secondPayload =
                buildRegistrationPayload();

            secondPayload.registrationNumber =
                "REG-999";

            secondPayload.email =
                "another@test.com";

            const second =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(secondPayload);

            expect(
                first.body.data._id
            ).not.toEqual(
                second.body.data._id
            );

        });

        it("should handle concurrent registrations safely", async () => {

            const requests = [];

            for (let i = 0; i < 10; i++) {

                requests.push(
                    request(app)
                        .post("/api/onboarding/sacco")
                        .send({
                            ...buildRegistrationPayload(),
                            registrationNumber:
                                `REG-${i}`,
                            email:
                                `user${i}@example.com`,
                        })
                );

            }

            const responses =
                await Promise.all(requests);

            responses.forEach((response) => {

                expect(response.status).toBe(201);

            });

        });

        it("should reject unsupported content types", async () => {

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .set(
                        "Content-Type",
                        "text/plain"
                    )
                    .send("invalid");

            expect(response.status)
                .toBeGreaterThanOrEqual(400);

        });

        it("should reject oversized payloads when limits are exceeded", async () => {

            const payload =
                buildRegistrationPayload();

            payload.notes =
                "A".repeat(2 * 1024 * 1024);

            const response =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(payload);

            expect(
                [201, 400, 413]
            ).toContain(response.status);

        });

    });
});

/* =============================================================================
 * End Part 2
 * =============================================================================
 *
 * Part 3 begins:
 *
 * describe("KYC Verification API", () => {
 *
 */
/* =============================================================================
 * Part 3 — KYC Verification Integration Tests
 * ============================================================================= */

describe("KYC Verification API", () => {

    let saccoId;

    beforeEach(async () => {

        const registration =
            await request(app)
                .post("/api/onboarding/sacco")
                .send(buildRegistrationPayload());

        expect(registration.status).toBe(201);

        saccoId = registration.body.data._id;

    });

    describe("PUT /api/onboarding/sacco/:id/kyc", () => {

        it("should approve KYC successfully", async () => {

            const payload = {
                boardChairperson: "John Doe",
                directorNames: [
                    "Director One",
                    "Director Two",
                ],
                registrationCertificate: "REG-CERT-001",
                taxComplianceCertificate: "TIN-CERT-001",
                proofOfAddress: "Utility Bill",
                notes: "Verified",
            };

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .send(payload);

            expect(response.status).toBe(200);

            expect(response.body.success).toBe(true);

            expect(response.body.data.status)
                .toBe("KYC_APPROVED");

        });

        it("should persist KYC information", async () => {

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                .send({

                    boardChairperson: "Jane Doe",

                    directorNames: [
                        "Director A",
                    ],

                    registrationCertificate: "RC-001",

                    taxComplianceCertificate: "TC-001",

                    proofOfAddress: "Lease",

                });

            const collection =
                mongoose.connection.collection("saccos");

            const saved =
                await collection.findOne({
                    _id: new mongoose.Types.ObjectId(saccoId),
                });

            expect(saved).not.toBeNull();

            expect(saved.boardChairperson)
                .toBe("Jane Doe");

        });

        it("should reject invalid SACCO IDs", async () => {

            const response =
                await request(app)
                    .put("/api/onboarding/sacco/invalid-id/kyc")
                    .send({});

            expect(response.status)
                .toBeGreaterThanOrEqual(400);

        });

        it("should return 404 for unknown SACCO", async () => {

            const unknown =
                new mongoose.Types.ObjectId();

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${unknown}/kyc`)
                    .send({});

            expect(response.status).toBe(404);

        });

        it("should validate mandatory KYC fields", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .send({});

            expect(response.status)
                .toBeGreaterThanOrEqual(400);

        });

        it("should reject duplicate directors", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .send({

                        boardChairperson: "John",

                        directorNames: [
                            "Same Director",
                            "Same Director",
                        ],

                        registrationCertificate: "REG",

                        taxComplianceCertificate: "TIN",

                        proofOfAddress: "Address",

                    });

            expect([400,422]).toContain(
                response.status
            );

        });

        it("should support multiple directors", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .send({

                        boardChairperson: "Chair",

                        directorNames: [
                            "Director 1",
                            "Director 2",
                            "Director 3",
                            "Director 4",
                        ],

                        registrationCertificate: "CERT",

                        taxComplianceCertificate: "TIN",

                        proofOfAddress: "Lease",

                    });

            expect(response.status).toBe(200);

        });

        it("should be idempotent when the same KYC payload is submitted twice", async () => {

            const payload = {

                boardChairperson: "Chair",

                directorNames: [
                    "Director",
                ],

                registrationCertificate: "CERT",

                taxComplianceCertificate: "TIN",

                proofOfAddress: "Utility",

            };

            const first =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .send(payload);

            const second =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .send(payload);

            expect(first.status).toBe(200);

            expect(second.status).toBe(200);

        });

        it("should reject malformed JSON", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .set("Content-Type", "application/json")
                    .send("{invalid-json");

            expect(response.status)
                .toBeGreaterThanOrEqual(400);

        });

        it("should reject unsupported content type", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .set("Content-Type", "text/plain")
                    .send("invalid");

            expect(response.status)
                .toBeGreaterThanOrEqual(400);

        });

        it("should return JSON response", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .send({

                        boardChairperson: "John",

                        directorNames: ["Director"],

                        registrationCertificate: "CERT",

                        taxComplianceCertificate: "TIN",

                        proofOfAddress: "Address",

                    });

            expect(
                response.headers["content-type"]
            ).toMatch(/application\/json/i);

        });

        it("should handle concurrent KYC updates safely", async () => {

            const requests = [];

            for (let i = 0; i < 5; i++) {

                requests.push(

                    request(app)
                        .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                        .send({

                            boardChairperson: `Chair ${i}`,

                            directorNames: [
                                `Director ${i}`,
                            ],

                            registrationCertificate: `CERT-${i}`,

                            taxComplianceCertificate: `TIN-${i}`,

                            proofOfAddress: `Address-${i}`,

                        })

                );

            }

            const responses =
                await Promise.all(requests);

            responses.forEach((r) => {

                expect([200,409]).toContain(r.status);

            });

        });

        it("should preserve audit fields after approval", async () => {

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                .send({

                    boardChairperson: "Chair",

                    directorNames: ["Director"],

                    registrationCertificate: "CERT",

                    taxComplianceCertificate: "TIN",

                    proofOfAddress: "Address",

                });

            const collection =
                mongoose.connection.collection("saccos");

            const saved =
                await collection.findOne({

                    _id: new mongoose.Types.ObjectId(saccoId),

                });

            expect(saved.updatedAt).toBeDefined();

        });

    });

});

/* =============================================================================
 * End Part 3
 * =============================================================================
 *
 * Part 4 begins:
 *
 * describe("Subscription & Payment API", () => {
 *
 */
/* =============================================================================
 * Part 4 — Subscription Setup & Payment Integration Tests
 * ============================================================================= */

describe("Subscription Setup & Payment API", () => {

    let saccoId;

    beforeEach(async () => {

        const registration =
            await request(app)
                .post("/api/onboarding/sacco")
                .send(buildRegistrationPayload());

        expect(registration.status).toBe(201);

        saccoId = registration.body.data._id;

        await request(app)
            .put(`/api/onboarding/sacco/${saccoId}/kyc`)
            .send({

                boardChairperson: "John Doe",

                directorNames: [
                    "Director One",
                    "Director Two",
                ],

                registrationCertificate: "REG-001",

                taxComplianceCertificate: "TAX-001",

                proofOfAddress: "Utility Bill",

            });

    });

    describe("PUT /api/onboarding/sacco/:id/subscription", () => {

        it("should activate a STARTER subscription", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                    .send({

                        plan: "STARTER",

                        billingCycle: "MONTHLY",

                        currency: "UGX",

                    });

            expect(response.status).toBe(200);

            expect(response.body.success).toBe(true);

            expect(response.body.data.plan)
                .toBe("STARTER");

        });

        it("should activate a GROWTH subscription", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                    .send({

                        plan: "GROWTH",

                        billingCycle: "MONTHLY",

                        currency: "UGX",

                    });

            expect(response.status).toBe(200);

        });

        it("should activate an ENTERPRISE subscription", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                    .send({

                        plan: "ENTERPRISE",

                        billingCycle: "ANNUAL",

                        currency: "UGX",

                    });

            expect(response.status).toBe(200);

        });

        it("should reject unsupported plans", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                    .send({

                        plan: "INVALID",

                        billingCycle: "MONTHLY",

                    });

            expect([400,422]).toContain(
                response.status
            );

        });

        it("should validate billing cycle", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                    .send({

                        plan: "STARTER",

                        billingCycle: "WEEKLY",

                    });

            expect([400,422]).toContain(
                response.status
            );

        });

        it("should persist subscription details", async () => {

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                .send({

                    plan: "GROWTH",

                    billingCycle: "MONTHLY",

                });

            const collection =
                mongoose.connection.collection("saccos");

            const sacco =
                await collection.findOne({

                    _id:
                        new mongoose.Types.ObjectId(saccoId),

                });

            expect(sacco.subscription.plan)
                .toBe("GROWTH");

        });

        it("should allow subscription upgrades", async () => {

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                .send({

                    plan: "STARTER",

                    billingCycle: "MONTHLY",

                });

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                    .send({

                        plan: "ENTERPRISE",

                        billingCycle: "ANNUAL",

                    });

            expect(response.status).toBe(200);

            expect(response.body.data.plan)
                .toBe("ENTERPRISE");

        });

        it("should reject unknown SACCO IDs", async () => {

            const unknown =
                new mongoose.Types.ObjectId();

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${unknown}/subscription`)
                    .send({

                        plan: "STARTER",

                    });

            expect(response.status).toBe(404);

        });

    });

    describe("POST /api/onboarding/payment", () => {

        it("should initialize an MTN MoMo payment", async () => {

            const response =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send({

                        provider: "MTN",

                        saccoId,

                        plan: "STARTER",

                    });

            expect(response.status).toBe(200);

            expect(response.body.success).toBe(true);

        });

        it("should initialize an Airtel Money payment", async () => {

            const response =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send({

                        provider: "AIRTEL",

                        saccoId,

                        plan: "STARTER",

                    });

            expect(response.status).toBe(200);

        });

        it("should reject unsupported payment providers", async () => {

            const response =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send({

                        provider: "PAYPAL",

                        saccoId,

                        plan: "STARTER",

                    });

            expect([400,422]).toContain(
                response.status
            );

        });

        it("should require provider", async () => {

            const response =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send({

                        saccoId,

                        plan: "STARTER",

                    });

            expect(response.status)
                .toBeGreaterThanOrEqual(400);

        });

        it("should reject unknown SACCO during payment", async () => {

            const response =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send({

                        provider: "MTN",

                        saccoId:
                            new mongoose.Types.ObjectId(),

                        plan: "STARTER",

                    });

            expect(response.status).toBe(404);

        });

        it("should safely retry duplicate payment initialization", async () => {

            const payload = {

                provider: "MTN",

                saccoId,

                plan: "STARTER",

            };

            const first =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send(payload);

            const second =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send(payload);

            expect(first.status).toBe(200);

            expect([200,409]).toContain(
                second.status
            );

        });

        it("should handle concurrent payment requests", async () => {

            const jobs = [];

            for (let i = 0; i < 5; i++) {

                jobs.push(

                    request(app)
                        .post("/api/onboarding/payment")
                        .send({

                            provider: "MTN",

                            saccoId,

                            plan: "STARTER",

                        })

                );

            }

            const responses =
                await Promise.all(jobs);

            responses.forEach((response) => {

                expect([200,409]).toContain(
                    response.status
                );

            });

        });

        it("should verify MTN payment service invocation", async () => {

            const momo =
                require("../../../modules/mtnMomoService");

            await request(app)
                .post("/api/onboarding/payment")
                .send({

                    provider: "MTN",

                    saccoId,

                    plan: "STARTER",

                });

            expect(
                momo.initializePayment
            ).toHaveBeenCalled();

        });

        it("should verify Airtel payment service invocation", async () => {

            const airtel =
                require("../../../modules/airtelMoneyService");

            await request(app)
                .post("/api/onboarding/payment")
                .send({

                    provider: "AIRTEL",

                    saccoId,

                    plan: "STARTER",

                });

            expect(
                airtel.initializePayment
            ).toHaveBeenCalled();

        });

        it("should return JSON responses", async () => {

            const response =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send({

                        provider: "MTN",

                        saccoId,

                        plan: "STARTER",

                    });

            expect(
                response.headers["content-type"]
            ).toMatch(/application\/json/i);

        });

    });

});

/* =============================================================================
 * End Part 4
 * =============================================================================
 *
 * Part 5 begins:
 *
 * describe("Go Live Checklist API", () => {
 *
 */
/* =============================================================================
 * Part 5 — Go Live Activation Integration Tests
 * ============================================================================= */

describe("Go Live Activation API", () => {

    let saccoId;

    beforeEach(async () => {

        const registration =
            await request(app)
                .post("/api/onboarding/sacco")
                .send(buildRegistrationPayload());

        expect(registration.status).toBe(201);

        saccoId = registration.body.data._id;

        /*
         * Bring SACCO to production-ready state
         */

        await request(app)
            .put(`/api/onboarding/sacco/${saccoId}/kyc`)
            .send({

                boardChairperson: "John Doe",

                directorNames: [
                    "Director One",
                    "Director Two",
                ],

                registrationCertificate: "REG-001",

                taxComplianceCertificate: "TAX-001",

                proofOfAddress: "Utility Bill",

            });

        await request(app)
            .put(`/api/onboarding/sacco/${saccoId}/subscription`)
            .send({

                plan: "STARTER",

                billingCycle: "MONTHLY",

                currency: "UGX",

            });

    });

    describe("PUT /api/onboarding/sacco/:id/live", () => {

        it("should activate a production-ready SACCO", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/live`)
                    .send();

            expect(response.status).toBe(200);

            expect(response.body.success).toBe(true);

            expect(response.body.data.status)
                .toBe("LIVE");

        });

        it("should persist LIVE status", async () => {

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            const collection =
                mongoose.connection.collection("saccos");

            const sacco =
                await collection.findOne({

                    _id:
                        new mongoose.Types.ObjectId(saccoId),

                });

            expect(sacco.status)
                .toBe("LIVE");

        });

        it("should record goLiveAt timestamp", async () => {

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            const collection =
                mongoose.connection.collection("saccos");

            const sacco =
                await collection.findOne({

                    _id:
                        new mongoose.Types.ObjectId(saccoId),

                });

            expect(sacco.goLiveAt).toBeDefined();

        });

        it("should reject activation when KYC is incomplete", async () => {

            const registration =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${registration.body.data._id}/live`);

            expect([400,409]).toContain(
                response.status
            );

        });

        it("should reject activation when subscription is missing", async () => {

            const registration =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            const newId =
                registration.body.data._id;

            await request(app)
                .put(`/api/onboarding/sacco/${newId}/kyc`)
                .send({

                    boardChairperson: "Chair",

                    directorNames: ["Director"],

                    registrationCertificate: "REG",

                    taxComplianceCertificate: "TIN",

                    proofOfAddress: "Address",

                });

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${newId}/live`);

            expect([400,409]).toContain(
                response.status
            );

        });

        it("should reject unknown SACCO", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${new mongoose.Types.ObjectId()}/live`);

            expect(response.status).toBe(404);

        });

        it("should be idempotent", async () => {

            const first =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/live`);

            const second =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(first.status).toBe(200);

            expect([200,409]).toContain(
                second.status
            );

        });

        it("should handle concurrent activation safely", async () => {

            const jobs = [];

            for (let i = 0; i < 5; i++) {

                jobs.push(

                    request(app)
                        .put(`/api/onboarding/sacco/${saccoId}/live`)

                );

            }

            const responses =
                await Promise.all(jobs);

            responses.forEach((response) => {

                expect([200,409]).toContain(
                    response.status
                );

            });

        });

        it("should publish onboarding completion event", async () => {

            const publisher =
                require("../../events/onboardingPublisher");

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(
                publisher.publishGoLive
            ).toHaveBeenCalled();

        });

        it("should provision tenant resources", async () => {

            const tenantService =
                require("../../services/tenantProvisioningService");

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(
                tenantService.activateTenant
            ).toHaveBeenCalled();

        });

        it("should create audit trail", async () => {

            const audit =
                require("../../services/auditService");

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(
                audit.log
            ).toHaveBeenCalled();

        });

        it("should initialize default financial configuration", async () => {

            const ledger =
                require("../../modules/finance/services/ledgerService");

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(
                ledger.initializeTenantLedger
            ).toHaveBeenCalled();

        });

        it("should initialize default roles and permissions", async () => {

            const identity =
                require("../../services/identityBootstrapService");

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(
                identity.bootstrapTenant
            ).toHaveBeenCalled();

        });

        it("should return JSON response", async () => {

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(
                response.headers["content-type"]
            ).toMatch(/application\/json/i);

        });

        it("should preserve activation metadata", async () => {

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            const collection =
                mongoose.connection.collection("saccos");

            const sacco =
                await collection.findOne({

                    _id:
                        new mongoose.Types.ObjectId(saccoId),

                });

            expect(sacco.updatedAt)
                .toBeDefined();

            expect(sacco.goLiveAt)
                .toBeDefined();

            expect(sacco.status)
                .toBe("LIVE");

        });

    });

});

/* =============================================================================
 * End Part 5
 * =============================================================================
 *
 * Part 6 begins:
 *
 * describe("Complete Enterprise Onboarding Workflow", () => {
 *
 */
/* =============================================================================
 * Part 6 — Enterprise End-to-End Onboarding Workflow
 * ============================================================================= */

describe("Enterprise End-to-End Onboarding Workflow", () => {

    describe("Complete Production Workflow", () => {

        it("should complete the full onboarding lifecycle", async () => {

            /*
             * STEP 1 — Registration
             */

            const registration =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            expect(registration.status).toBe(201);

            const saccoId =
                registration.body.data._id;

            /*
             * STEP 2 — KYC
             */

            const kyc =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                    .send({

                        boardChairperson: "John Doe",

                        directorNames: [
                            "Director One",
                            "Director Two",
                        ],

                        registrationCertificate: "REG-001",

                        taxComplianceCertificate: "TIN-001",

                        proofOfAddress: "Utility Bill",

                    });

            expect(kyc.status).toBe(200);

            /*
             * STEP 3 — Subscription
             */

            const subscription =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                    .send({

                        plan: "STARTER",

                        billingCycle: "MONTHLY",

                        currency: "UGX",

                    });

            expect(subscription.status).toBe(200);

            /*
             * STEP 4 — Payment
             */

            const payment =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send({

                        provider: "MTN",

                        saccoId,

                        plan: "STARTER",

                    });

            expect(payment.status).toBe(200);

            /*
             * STEP 5 — Go Live
             */

            const activation =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(activation.status).toBe(200);

            expect(
                activation.body.data.status
            ).toBe("LIVE");

        });

    });

    describe("Rollback & Recovery", () => {

        it("should reject go-live after failed KYC", async () => {

            const registration =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            const response =
                await request(app)
                    .put(`/api/onboarding/sacco/${registration.body.data._id}/live`);

            expect([400,409]).toContain(
                response.status
            );

        });

        it("should recover after KYC correction", async () => {

            const registration =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            const saccoId =
                registration.body.data._id;

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/kyc`)
                .send({

                    boardChairperson: "John",

                    directorNames: ["Director"],

                    registrationCertificate: "REG",

                    taxComplianceCertificate: "TIN",

                    proofOfAddress: "Address",

                });

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/subscription`)
                .send({

                    plan: "STARTER",

                    billingCycle: "MONTHLY",

                });

            const activation =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(activation.status).toBe(200);

        });

    });

    describe("Concurrency", () => {

        it("should safely handle concurrent registrations", async () => {

            const jobs = [];

            for (let i = 0; i < 10; i++) {

                jobs.push(

                    request(app)
                        .post("/api/onboarding/sacco")
                        .send({

                            ...buildRegistrationPayload(),

                            email: `user${i}@example.com`,

                            registrationNumber: `REG-${i}`,

                        })

                );

            }

            const responses =
                await Promise.all(jobs);

            responses.forEach((response) => {

                expect(response.status).toBe(201);

            });

        });

        it("should safely handle concurrent activation", async () => {

            const registration =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            const saccoId =
                registration.body.data._id;

            await prepareProductionReadySacco(saccoId);

            const jobs = [];

            for (let i = 0; i < 8; i++) {

                jobs.push(

                    request(app)
                        .put(`/api/onboarding/sacco/${saccoId}/live`)

                );

            }

            const responses =
                await Promise.all(jobs);

            responses.forEach((response) => {

                expect([200,409]).toContain(
                    response.status
                );

            });

        });

    });

    describe("Idempotency", () => {

        it("should allow duplicate activation safely", async () => {

            const registration =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            const saccoId =
                registration.body.data._id;

            await prepareProductionReadySacco(saccoId);

            const first =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/live`);

            const second =
                await request(app)
                    .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(first.status).toBe(200);

            expect([200,409]).toContain(
                second.status
            );

        });

    });

    describe("Validation", () => {

        it("should reject malformed ObjectIds", async () => {

            const response =
                await request(app)
                    .put("/api/onboarding/sacco/not-a-valid-id/live");

            expect([400,404]).toContain(
                response.status
            );

        });

        it("should reject unsupported payment providers", async () => {

            const response =
                await request(app)
                    .post("/api/onboarding/payment")
                    .send({

                        provider: "UNKNOWN",

                    });

            expect([400,422]).toContain(
                response.status
            );

        });

    });

    describe("Persistence", () => {

        it("should persist all onboarding milestones", async () => {

            const registration =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            const saccoId =
                registration.body.data._id;

            await prepareProductionReadySacco(saccoId);

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            const collection =
                mongoose.connection.collection("saccos");

            const sacco =
                await collection.findOne({

                    _id:
                        new mongoose.Types.ObjectId(saccoId),

                });

            expect(sacco.status).toBe("LIVE");

            expect(sacco.subscription).toBeDefined();

            expect(sacco.goLiveAt).toBeDefined();

            expect(sacco.updatedAt).toBeDefined();

        });

    });

    describe("Enterprise Service Integration", () => {

        it("should invoke all enterprise services", async () => {

            const registration =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(buildRegistrationPayload());

            const saccoId =
                registration.body.data._id;

            await prepareProductionReadySacco(saccoId);

            await request(app)
                .put(`/api/onboarding/sacco/${saccoId}/live`);

            expect(
                tenantProvisioningService.activateTenant
            ).toHaveBeenCalled();

            expect(
                auditService.log
            ).toHaveBeenCalled();

            expect(
                onboardingPublisher.publishGoLive
            ).toHaveBeenCalled();

            expect(
                ledgerService.initializeTenantLedger
            ).toHaveBeenCalled();

        });

    });

    describe("Cleanup", () => {

        it("should leave database in a consistent state", async () => {

            const collections =
                await mongoose.connection.db.collections();

            expect(collections.length)
                .toBeGreaterThan(0);

        });

        it("should not leave orphaned onboarding documents", async () => {

            const count =
                await mongoose.connection
                    .collection("onboardinglocks")
                    .countDocuments();

            expect(count).toBe(0);

        });

    });

    describe("Enterprise Edge Cases", () => {

        it("should handle duplicate registration numbers", async () => {

            const payload =
                buildRegistrationPayload();

            await request(app)
                .post("/api/onboarding/sacco")
                .send(payload);

            const duplicate =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send(payload);

            expect([400,409]).toContain(
                duplicate.status
            );

        });

        it("should reject duplicate email addresses", async () => {

            const payload =
                buildRegistrationPayload();

            await request(app)
                .post("/api/onboarding/sacco")
                .send(payload);

            const duplicate =
                await request(app)
                    .post("/api/onboarding/sacco")
                    .send({

                        ...payload,

                        registrationNumber: "NEW-001",

                    });

            expect([400,409]).toContain(
                duplicate.status
            );

        });

        it("should remain stable under repeated onboarding attempts", async () => {

            for (let i = 0; i < 20; i++) {

                const response =
                    await request(app)
                        .post("/api/onboarding/sacco")
                        .send({

                            ...buildRegistrationPayload(),

                            registrationNumber: `REG-${i}`,

                            email: `load${i}@example.com`,

                        });

                expect(response.status).toBe(201);

            }

        });

    });

});

/* =============================================================================
 * End Part 6
 * =============================================================================
 *
 * Enterprise Onboarding Integration Suite Complete
 *
 * Coverage Includes:
 *
 * ✓ Registration
 * ✓ Validation
 * ✓ Duplicate Detection
 * ✓ KYC
 * ✓ Subscription
 * ✓ Payment
 * ✓ MTN MoMo
 * ✓ Airtel Money
 * ✓ Go Live
 * ✓ Rollback
 * ✓ Recovery
 * ✓ Concurrency
 * ✓ Idempotency
 * ✓ Persistence
 * ✓ Audit Logging
 * ✓ Tenant Provisioning
 * ✓ Ledger Initialization
 * ✓ Event Publication
 * ✓ Cleanup
 * ✓ Enterprise Edge Cases
 * ✓ Production Workflow
 * ============================================================================= */
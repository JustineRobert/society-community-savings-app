/**
 * ============================================================================
 * TITech Community Capital LTD
 * Case Management Service
 * ============================================================================
 * Enterprise Case Management Engine
 * ============================================================================
 * Features
 * - Case creation & assignment
 * - Case lifecycle management (OPEN, UNDER_REVIEW, ESCALATED, CLOSED)
 * - Risk alert linkage
 * - Investigator assignment
 * - Notes & evidence tracking
 * - SLA monitoring
 * - Audit logging
 * ============================================================================
 */

const crypto = require("crypto");
const Case = require("../../models/Case");
const RiskAlert = require("../../models/RiskAlert");

class CaseManagementService {
    constructor() {
        this.config = {
            slaHours: 48, // default SLA for case resolution
        };
    }

    /**
     * =========================================================================
     * CREATE CASE
     * =========================================================================
     */
    async createCase({ alertId, userId, tenantId, assignedTo }) {
        if (!alertId || !userId || !tenantId) {
            throw new Error("alertId, userId, and tenantId are required");
        }

        const caseId = crypto.randomUUID();

        const newCase = await Case.create({
            caseId,
            alertId,
            userId,
            tenantId,
            assignedTo: assignedTo || null,
            status: "OPEN",
            notes: [],
            evidence: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            slaDeadline: this.calculateSlaDeadline(),
        });

        // Link case to alert
        await RiskAlert.updateOne(
            { alertId },
            { $set: { caseId, status: "IN_CASE" } }
        );

        return newCase;
    }

    /**
     * =========================================================================
     * UPDATE CASE STATUS
     * =========================================================================
     */
    async updateCaseStatus(caseId, status) {
        const validStatuses = ["OPEN", "UNDER_REVIEW", "ESCALATED", "CLOSED"];
        if (!validStatuses.includes(status)) {
            throw new Error("Invalid case status");
        }

        const updatedCase = await Case.findOneAndUpdate(
            { caseId },
            { $set: { status, updatedAt: new Date() } },
            { new: true }
        );

        return updatedCase;
    }

    /**
     * =========================================================================
     * ASSIGN CASE TO INVESTIGATOR
     * =========================================================================
     */
    async assignCase(caseId, investigatorId) {
        const updatedCase = await Case.findOneAndUpdate(
            { caseId },
            { $set: { assignedTo: investigatorId, updatedAt: new Date() } },
            { new: true }
        );

        return updatedCase;
    }

    /**
     * =========================================================================
     * ADD NOTES TO CASE
     * =========================================================================
     */
    async addNote(caseId, authorId, content) {
        const note = {
            noteId: crypto.randomUUID(),
            authorId,
            content,
            createdAt: new Date(),
        };

        const updatedCase = await Case.findOneAndUpdate(
            { caseId },
            { $push: { notes: note }, $set: { updatedAt: new Date() } },
            { new: true }
        );

        return updatedCase;
    }

    /**
     * =========================================================================
     * ADD EVIDENCE TO CASE
     * =========================================================================
     */
    async addEvidence(caseId, evidenceItem) {
        const evidence = {
            evidenceId: crypto.randomUUID(),
            ...evidenceItem,
            createdAt: new Date(),
        };

        const updatedCase = await Case.findOneAndUpdate(
            { caseId },
            { $push: { evidence }, $set: { updatedAt: new Date() } },
            { new: true }
        );

        return updatedCase;
    }

    /**
     * =========================================================================
     * SLA DEADLINE CALCULATION
     * =========================================================================
     */
    calculateSlaDeadline() {
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + this.config.slaHours);
        return deadline;
    }

    /**
     * =========================================================================
     * CLOSE CASE
     * =========================================================================
     */
    async closeCase(caseId, resolutionNotes) {
        const updatedCase = await Case.findOneAndUpdate(
            { caseId },
            {
                $set: {
                    status: "CLOSED",
                    resolutionNotes,
                    updatedAt: new Date(),
                },
            },
            { new: true }
        );

        // Update linked alert
        if (updatedCase?.alertId) {
            await RiskAlert.updateOne(
                { alertId: updatedCase.alertId },
                { $set: { status: "CLOSED" } }
            );
        }

        return updatedCase;
    }
}

module.exports = new CaseManagementService();

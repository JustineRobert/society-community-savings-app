'use strict';

const mongoose = require('mongoose');

/**
 * ============================================================================
 * SYSTEM SETTING SCHEMA
 * ============================================================================
 * TITech Community Capital LTD
 * SACCO Core Banking Platform
 *
 * Features
 * ----------------------------------------------------------------------------
 * ✅ Multi-Tenant Settings
 * ✅ Global Settings
 * ✅ Tenant Overrides
 * ✅ Feature Flags
 * ✅ Dynamic JSON Values
 * ✅ Auditability
 * ✅ Compliance Configuration
 * ✅ Loan Configuration
 * ✅ Savings Configuration
 * ✅ Accounting Configuration
 * ✅ Mobile Money Configuration
 * ✅ AI & Fraud Controls
 * ============================================================================
 */

const SystemSettingSchema = new mongoose.Schema(
{
    /**
     * Tenant
     */

    tenantId: {
        type: String,
        default: 'SYSTEM',
        required: true,
        index: true
    },

    /**
     * Unique Key
     *
     * Examples:
     *
     * MIN_LOAN_AMOUNT
     * MAX_LOAN_AMOUNT
     * AML_ENABLED
     * SYSTEM_CURRENCY
     */

    key: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },

    /**
     * Category
     */

    category: {
        type: String,
        required: true,
        enum: [
            'SYSTEM',
            'LOANS',
            'SAVINGS',
            'SHARES',
            'FIXED_DEPOSITS',
            'AML',
            'KYC',
            'FRAUD',
            'AI',
            'NOTIFICATIONS',
            'AUDIT',
            'ACCOUNTING',
            'GENERAL_LEDGER',
            'REPORTING',
            'MOBILE_MONEY',
            'API_GATEWAY',
            'WEBHOOKS',
            'SECURITY',
            'DISASTER_RECOVERY',
            'BACKUP',
            'COMPLIANCE'
        ],
        index: true
    },

    /**
     * Display Name
     */

    name: {
        type: String,
        trim: true,
        maxlength: 200
    },

    /**
     * Description
     */

    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },

    /**
     * Setting Value
     */

    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },

    /**
     * Value Type
     */

    valueType: {
        type: String,
        enum: [
            'STRING',
            'NUMBER',
            'BOOLEAN',
            'JSON',
            'ARRAY'
        ],
        default: 'STRING'
    },

    /**
     * Feature Status
     */

    enabled: {
        type: Boolean,
        default: true,
        index: true
    },

    /**
     * Protected System Setting
     */

    isSystem: {
        type: Boolean,
        default: false
    },

    /**
     * Can User Modify?
     */

    editable: {
        type: Boolean,
        default: true
    },

    /**
     * BOU / AML / Regulatory
     */

    complianceRelevant: {
        type: Boolean,
        default: false,
        index: true
    },

    /**
     * Version Tracking
     */

    version: {
        type: Number,
        default: 1
    },

    /**
     * Updated By
     */

    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    /**
     * Metadata
     */

    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
},
{
    timestamps: true,

    versionKey: false,

    toJSON: {
        virtuals: true,

        transform(doc, ret) {

            ret.id = ret._id.toString();

            delete ret._id;

            return ret;
        }
    },

    toObject: {
        virtuals: true
    }
}
);

/**
 * ============================================================================
 * INDEXES
 * ============================================================================
 */

SystemSettingSchema.index(
{
    tenantId: 1,
    key: 1
},
{
    unique: true
});

SystemSettingSchema.index({
    tenantId: 1,
    category: 1
});

SystemSettingSchema.index({
    tenantId: 1,
    enabled: 1
});

SystemSettingSchema.index({
    tenantId: 1,
    complianceRelevant: 1
});

SystemSettingSchema.index({
    category: 1,
    key: 1
});

SystemSettingSchema.index({
    createdAt: -1
});

SystemSettingSchema.index({
    updatedAt: -1
});

/**
 * ============================================================================
 * STATIC METHODS
 * ============================================================================
 */

SystemSettingSchema.statics.getValue =
async function(
    key,
    tenantId = 'SYSTEM'
) {

    const setting =
        await this.findOne({
            tenantId,
            key: key.toUpperCase(),
            enabled: true
        });

    return setting
        ? setting.value
        : null;
};

SystemSettingSchema.statics.setValue =
async function(
    key,
    value,
    tenantId = 'SYSTEM',
    updatedBy = null
) {

    return this.findOneAndUpdate(
        {
            tenantId,
            key: key.toUpperCase()
        },
        {
            $set: {
                value,
                updatedBy
            },
            $inc: {
                version: 1
            }
        },
        {
            new: true,
            upsert: true
        }
    );
};

SystemSettingSchema.statics.getCategory =
async function(
    category,
    tenantId = 'SYSTEM'
) {

    return this.find({
        tenantId,
        category,
        enabled: true
    }).sort({
        key: 1
    });
};

SystemSettingSchema.statics.getAllSettings =
async function(
    tenantId = 'SYSTEM'
) {

    return this.find({
        tenantId,
        enabled: true
    })
    .sort({
        category: 1,
        key: 1
    });
};

/**
 * ============================================================================
 * INSTANCE METHODS
 * ============================================================================
 */

SystemSettingSchema.methods.enable =
async function() {

    this.enabled = true;

    return this.save();
};

SystemSettingSchema.methods.disable =
async function() {

    this.enabled = false;

    return this.save();
};

SystemSettingSchema.methods.bumpVersion =
async function() {

    this.version += 1;

    return this.save();
};

/**
 * ============================================================================
 * MIDDLEWARE
 * ============================================================================
 */

SystemSettingSchema.pre(
    'save',
    function(next) {

        if (this.key) {

            this.key =
                this.key
                    .trim()
                    .toUpperCase();
        }

        if (
            this.isModified('value')
        ) {

            this.version += 1;
        }

        next();
    }
);

/**
 * ============================================================================
 * EXPORT
 * ============================================================================
 */

module.exports = mongoose.model(
    'SystemSetting',
    SystemSettingSchema
);
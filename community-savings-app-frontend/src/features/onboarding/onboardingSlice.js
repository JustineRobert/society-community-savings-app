// frontend/src/features/onboarding/onboardingSlice.js

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import OnboardingAPI from "../../services/onboardingService";

/* ============================================================
   Initial State
============================================================ */

const initialState = {
    draft: null,

    registration: {
        data: null,
        status: "idle",
        loading: false,
        error: null,
        success: null,
    },

    kyc: {
        data: null,
        status: "idle",
        loading: false,
        error: null,
        success: null,
    },

    subscription: {
        data: null,
        status: "idle",
        loading: false,
        error: null,
        success: null,
    },

    payment: {
        data: null,
        provider: null,
        loading: false,
        status: "idle",
        error: null,
    },

    goLive: {
        data: null,
        loading: false,
        status: "idle",
        error: null,
        success: null,
    },

    uploadedFiles: [],

    onboardingProgress: 0,

    currentStep: 1,

    completedSteps: [],
};

/* ============================================================
   Async Actions
============================================================ */

export const registerSacco = createAsyncThunk(
    "onboarding/registerSacco",
    async (formData, thunkAPI) => {
        try {
            return await OnboardingAPI.registerSacco(formData);
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error?.response?.data ||
                error.message
            );
        }
    }
);

export const verifyKYC = createAsyncThunk(
    "onboarding/verifyKYC",
    async ({ saccoId, payload }, thunkAPI) => {
        try {
            const response =
                await OnboardingAPI.verifyKYC(
                    saccoId,
                    payload
                );

            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error?.response?.data ||
                error.message
            );
        }
    }
);

export const setupSubscription = createAsyncThunk(
    "onboarding/setupSubscription",
    async ({ saccoId, payload }, thunkAPI) => {
        try {
            const response =
                await OnboardingAPI.setupSubscription(
                    saccoId,
                    payload
                );

            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error?.response?.data ||
                error.message
            );
        }
    }
);

export const initializePayment = createAsyncThunk(
    "onboarding/initializePayment",
    async (payload, thunkAPI) => {
        try {
            return await OnboardingAPI.initializePayment(
                payload
            );
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error?.response?.data ||
                error.message
            );
        }
    }
);

export const activateGoLive = createAsyncThunk(
    "onboarding/activateGoLive",
    async (saccoId, thunkAPI) => {
        try {
            const response =
                await OnboardingAPI.goLive(saccoId);

            return response.data;
        } catch (error) {
            return thunkAPI.rejectWithValue(
                error?.response?.data ||
                error.message
            );
        }
    }
);

/* ============================================================
   Slice
============================================================ */

const onboardingSlice = createSlice({
    name: "onboarding",

    initialState,

    reducers: {

        saveDraft(state, action) {
            state.draft = action.payload;
        },

        clearDraft(state) {
            state.draft = null;
        },

        restoreDraft(state, action) {
            state.draft = action.payload;
        },

        setCurrentStep(state, action) {
            state.currentStep = action.payload;
        },

        nextStep(state) {
            state.currentStep += 1;
        },

        previousStep(state) {
            state.currentStep -= 1;
        },

        completeStep(state, action) {

            if (
                !state.completedSteps.includes(
                    action.payload
                )
            ) {
                state.completedSteps.push(
                    action.payload
                );
            }

            state.onboardingProgress =
                Math.round(
                    (state.completedSteps.length /
                        6) *
                    100
                );
        },

        uploadFileSuccess(state, action) {
            state.uploadedFiles.push(action.payload);
        },

        removeUploadedFile(state, action) {
            state.uploadedFiles =
                state.uploadedFiles.filter(
                    (file) =>
                        file.id !== action.payload
                );
        },

        resetOnboarding() {
            return initialState;
        },
    },

    extraReducers: (builder) => {

        /* ===========================
           Register
        =========================== */

        builder
            .addCase(registerSacco.pending, (state) => {
                state.registration.loading = true;
                state.registration.error = null;
                state.registration.success = null;
                state.registration.status = "loading";
            })

            .addCase(registerSacco.fulfilled, (state, action) => {
                state.registration.loading = false;
                state.registration.status = "success";
                state.registration.data = action.payload;
                state.registration.success =
                    "SACCO registered successfully.";
            })

            .addCase(registerSacco.rejected, (state, action) => {
                state.registration.loading = false;
                state.registration.status = "failed";
                state.registration.error = action.payload;
            });

        /* ===========================
           KYC
        =========================== */

        builder
            .addCase(verifyKYC.pending, (state) => {
                state.kyc.loading = true;
                state.kyc.error = null;
            })

            .addCase(verifyKYC.fulfilled, (state, action) => {
                state.kyc.loading = false;
                state.kyc.status = "success";
                state.kyc.success = "KYC Approved";
                state.kyc.data = action.payload;
            })

            .addCase(verifyKYC.rejected, (state, action) => {
                state.kyc.loading = false;
                state.kyc.error = action.payload;
            });

        /* ===========================
           Subscription
        =========================== */

        builder
            .addCase(setupSubscription.pending, (state) => {
                state.subscription.loading = true;
            })

            .addCase(setupSubscription.fulfilled, (state, action) => {
                state.subscription.loading = false;
                state.subscription.status = "success";
                state.subscription.success =
                    "Subscription Configured";
                state.subscription.data = action.payload;
            })

            .addCase(setupSubscription.rejected, (state, action) => {
                state.subscription.loading = false;
                state.subscription.error = action.payload;
            });

        /* ===========================
           Payment
        =========================== */

        builder
            .addCase(initializePayment.pending, (state) => {
                state.payment.loading = true;
            })

            .addCase(initializePayment.fulfilled, (state, action) => {
                state.payment.loading = false;
                state.payment.status = "success";
                state.payment.data = action.payload;
                state.payment.provider =
                    action.meta.arg.provider;
            })

            .addCase(initializePayment.rejected, (state, action) => {
                state.payment.loading = false;
                state.payment.error = action.payload;
            });

        /* ===========================
           Go Live
        =========================== */

        builder
            .addCase(activateGoLive.pending, (state) => {
                state.goLive.loading = true;
            })

            .addCase(activateGoLive.fulfilled, (state, action) => {
                state.goLive.loading = false;
                state.goLive.status = "success";
                state.goLive.success =
                    "SACCO is now LIVE";
                state.goLive.data = action.payload;
            })

            .addCase(activateGoLive.rejected, (state, action) => {
                state.goLive.loading = false;
                state.goLive.error = action.payload;
            });

    },
});

/* ============================================================
   Actions
============================================================ */

export const {
    saveDraft,
    clearDraft,
    restoreDraft,

    setCurrentStep,
    nextStep,
    previousStep,

    completeStep,

    uploadFileSuccess,
    removeUploadedFile,

    resetOnboarding,
} = onboardingSlice.actions;

/* ============================================================
   Selectors
============================================================ */

export const selectDraft = (state) =>
    state.onboarding.draft;

export const selectRegistration = (state) =>
    state.onboarding.registration;

export const selectKYC = (state) =>
    state.onboarding.kyc;

export const selectSubscription = (state) =>
    state.onboarding.subscription;

export const selectPayment = (state) =>
    state.onboarding.payment;

export const selectGoLive = (state) =>
    state.onboarding.goLive;

export const selectCurrentStep = (state) =>
    state.onboarding.currentStep;

export const selectProgress = (state) =>
    state.onboarding.onboardingProgress;

export const selectCompletedSteps = (state) =>
    state.onboarding.completedSteps;

export const selectUploadedFiles = (state) =>
    state.onboarding.uploadedFiles;

/* ============================================================
   Reducer
============================================================ */

export default onboardingSlice.reducer;
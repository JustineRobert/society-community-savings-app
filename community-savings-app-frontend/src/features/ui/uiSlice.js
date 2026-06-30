// ============================================================================
// TITech Community Capital
// Enterprise UI Slice
// File: frontend/src/features/ui/uiSlice.js
// Production Grade
// ============================================================================

import {
  createSlice,
  createSelector,
} from "@reduxjs/toolkit";

// ============================================================================
// Constants
// ============================================================================

export const THEMES = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
};

export const SIDEBAR_STATES = {
  EXPANDED: "expanded",
  COLLAPSED: "collapsed",
};

export const LAYOUTS = {
  DEFAULT: "default",
  COMPACT: "compact",
  EXECUTIVE: "executive",
};

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  initialized: false,

  theme: THEMES.SYSTEM,

  layout: LAYOUTS.DEFAULT,

  sidebar: {
    state:
      SIDEBAR_STATES.EXPANDED,
    mobileOpen: false,
  },

  page: {
    title:
      "TITech Community Capital",
    subtitle: "",
    breadcrumbs: [],
  },

  loading: {
    global: false,
    page: false,
  },

  modals: {},

  drawers: {},

  notificationsPanel: false,

  search: {
    open: false,
    query: "",
  },

  fullscreen: false,

  commandPalette: false,

  maintenanceMode: false,

  network: {
    online:
      typeof navigator !==
      "undefined"
        ? navigator.onLine
        : true,
  },

  preferences: {
    compactTables: false,
    animations: true,
    reducedMotion: false,
    density: "comfortable",
  },
};

// ============================================================================
// Slice
// ============================================================================

const uiSlice = createSlice({
  name: "ui",

  initialState,

  reducers: {
    // =======================================================================
    // Initialization
    // =======================================================================

    initializeUI(state) {
      state.initialized = true;
    },

    resetUIState() {
      return initialState;
    },

    // =======================================================================
    // Theme
    // =======================================================================

    setTheme(
      state,
      action
    ) {
      state.theme =
        action.payload;
    },

    toggleTheme(
      state
    ) {
      state.theme =
        state.theme ===
        THEMES.DARK
          ? THEMES.LIGHT
          : THEMES.DARK;
    },

    // =======================================================================
    // Layout
    // =======================================================================

    setLayout(
      state,
      action
    ) {
      state.layout =
        action.payload;
    },

    // =======================================================================
    // Sidebar
    // =======================================================================

    toggleSidebar(
      state
    ) {
      state.sidebar.state =
        state.sidebar.state ===
        SIDEBAR_STATES.EXPANDED
          ? SIDEBAR_STATES.COLLAPSED
          : SIDEBAR_STATES.EXPANDED;
    },

    setSidebarState(
      state,
      action
    ) {
      state.sidebar.state =
        action.payload;
    },

    openMobileSidebar(
      state
    ) {
      state.sidebar.mobileOpen = true;
    },

    closeMobileSidebar(
      state
    ) {
      state.sidebar.mobileOpen = false;
    },

    toggleMobileSidebar(
      state
    ) {
      state.sidebar.mobileOpen =
        !state.sidebar
          .mobileOpen;
    },

    // =======================================================================
    // Page Metadata
    // =======================================================================

    setPageTitle(
      state,
      action
    ) {
      state.page.title =
        action.payload;
    },

    setPageSubtitle(
      state,
      action
    ) {
      state.page.subtitle =
        action.payload;
    },

    setBreadcrumbs(
      state,
      action
    ) {
      state.page.breadcrumbs =
        action.payload ||
        [];
    },

    clearPageMetadata(
      state
    ) {
      state.page = {
        title:
          "TITech Community Capital",
        subtitle: "",
        breadcrumbs: [],
      };
    },

    // =======================================================================
    // Loading
    // =======================================================================

    setGlobalLoading(
      state,
      action
    ) {
      state.loading.global =
        action.payload;
    },

    setPageLoading(
      state,
      action
    ) {
      state.loading.page =
        action.payload;
    },

    // =======================================================================
    // Modals
    // =======================================================================

    openModal(
      state,
      action
    ) {
      const {
        id,
        props = {},
      } = action.payload;

      state.modals[id] = {
        open: true,
        props,
      };
    },

    closeModal(
      state,
      action
    ) {
      delete state.modals[
        action.payload
      ];
    },

    closeAllModals(
      state
    ) {
      state.modals = {};
    },

    // =======================================================================
    // Drawers
    // =======================================================================

    openDrawer(
      state,
      action
    ) {
      const {
        id,
        props = {},
      } = action.payload;

      state.drawers[id] = {
        open: true,
        props,
      };
    },

    closeDrawer(
      state,
      action
    ) {
      delete state.drawers[
        action.payload
      ];
    },

    closeAllDrawers(
      state
    ) {
      state.drawers = {};
    },

    // =======================================================================
    // Notifications Panel
    // =======================================================================

    openNotificationsPanel(
      state
    ) {
      state.notificationsPanel = true;
    },

    closeNotificationsPanel(
      state
    ) {
      state.notificationsPanel = false;
    },

    toggleNotificationsPanel(
      state
    ) {
      state.notificationsPanel =
        !state
          .notificationsPanel;
    },

    // =======================================================================
    // Search
    // =======================================================================

    openSearch(
      state
    ) {
      state.search.open = true;
    },

    closeSearch(
      state
    ) {
      state.search.open = false;
      state.search.query = "";
    },

    setSearchQuery(
      state,
      action
    ) {
      state.search.query =
        action.payload;
    },

    // =======================================================================
    // Command Palette
    // =======================================================================

    openCommandPalette(
      state
    ) {
      state.commandPalette = true;
    },

    closeCommandPalette(
      state
    ) {
      state.commandPalette = false;
    },

    toggleCommandPalette(
      state
    ) {
      state.commandPalette =
        !state
          .commandPalette;
    },

    // =======================================================================
    // Fullscreen
    // =======================================================================

    setFullscreen(
      state,
      action
    ) {
      state.fullscreen =
        action.payload;
    },

    toggleFullscreen(
      state
    ) {
      state.fullscreen =
        !state.fullscreen;
    },

    // =======================================================================
    // Maintenance Mode
    // =======================================================================

    setMaintenanceMode(
      state,
      action
    ) {
      state.maintenanceMode =
        action.payload;
    },

    // =======================================================================
    // Network State
    // =======================================================================

    setNetworkStatus(
      state,
      action
    ) {
      state.network.online =
        action.payload;
    },

    // =======================================================================
    // Preferences
    // =======================================================================

    setUIPreferences(
      state,
      action
    ) {
      state.preferences = {
        ...state.preferences,
        ...action.payload,
      };
    },

    setCompactTables(
      state,
      action
    ) {
      state.preferences.compactTables =
        action.payload;
    },

    setAnimations(
      state,
      action
    ) {
      state.preferences.animations =
        action.payload;
    },

    setReducedMotion(
      state,
      action
    ) {
      state.preferences.reducedMotion =
        action.payload;
    },

    setDensity(
      state,
      action
    ) {
      state.preferences.density =
        action.payload;
    },
  },
});

// ============================================================================
// Actions
// ============================================================================

export const {
  initializeUI,
  resetUIState,
  setTheme,
  toggleTheme,
  setLayout,
  toggleSidebar,
  setSidebarState,
  openMobileSidebar,
  closeMobileSidebar,
  toggleMobileSidebar,
  setPageTitle,
  setPageSubtitle,
  setBreadcrumbs,
  clearPageMetadata,
  setGlobalLoading,
  setPageLoading,
  openModal,
  closeModal,
  closeAllModals,
  openDrawer,
  closeDrawer,
  closeAllDrawers,
  openNotificationsPanel,
  closeNotificationsPanel,
  toggleNotificationsPanel,
  openSearch,
  closeSearch,
  setSearchQuery,
  openCommandPalette,
  closeCommandPalette,
  toggleCommandPalette,
  setFullscreen,
  toggleFullscreen,
  setMaintenanceMode,
  setNetworkStatus,
  setUIPreferences,
  setCompactTables,
  setAnimations,
  setReducedMotion,
  setDensity,
} = uiSlice.actions;

// ============================================================================
// Selectors
// ============================================================================

export const selectUI =
  (state) => state.ui;

export const selectTheme =
  (state) => state.ui.theme;

export const selectLayout =
  (state) => state.ui.layout;

export const selectSidebar =
  (state) => state.ui.sidebar;

export const selectPage =
  (state) => state.ui.page;

export const selectGlobalLoading =
  (state) =>
    state.ui.loading.global;

export const selectPageLoading =
  (state) =>
    state.ui.loading.page;

export const selectModals =
  (state) => state.ui.modals;

export const selectDrawers =
  (state) => state.ui.drawers;

export const selectSearch =
  (state) => state.ui.search;

export const selectPreferences =
  (state) =>
    state.ui.preferences;

export const selectNotificationsPanel =
  (state) =>
    state.ui
      .notificationsPanel;

export const selectFullscreen =
  (state) =>
    state.ui.fullscreen;

export const selectMaintenanceMode =
  (state) =>
    state.ui
      .maintenanceMode;

export const selectNetworkOnline =
  (state) =>
    state.ui.network.online;

export const selectIsMobileSidebarOpen =
  createSelector(
    [selectSidebar],
    (sidebar) =>
      sidebar.mobileOpen
  );

export const selectSidebarCollapsed =
  createSelector(
    [selectSidebar],
    (sidebar) =>
      sidebar.state ===
      SIDEBAR_STATES.COLLAPSED
  );

// ============================================================================
// Reducer
// ============================================================================

export default uiSlice.reducer;
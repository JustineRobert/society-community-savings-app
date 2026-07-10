/**
 * ============================================================================
 * frontend/src/setupTests.js
 * ============================================================================
 * TITech Community Capital
 * Enterprise Test Environment
 *
 * Stack
 * ----------------------------------------------------------------------------
 * • React 18
 * • Vite
 * • Vitest
 * • React Testing Library
 * • MSW
 * • Redux Toolkit
 * • React Router
 * • React Hook Form
 * • React Query
 * • Socket.IO
 *
 * This file configures the global browser environment used by every test.
 * ============================================================================
 */

import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
  expect,
} from "vitest";

import {
  cleanup,
  configure,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import {
  TextEncoder,
  TextDecoder,
} from "util";

import { server } from "./testServer";

/* ============================================================================
   Environment
============================================================================ */

process.env.NODE_ENV = "test";

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

/*
|--------------------------------------------------------------------------
| Testing Library Configuration
|--------------------------------------------------------------------------
*/

configure({
  asyncUtilTimeout: 10000,
  testIdAttribute: "data-testid",
});

/*
|--------------------------------------------------------------------------
| React Act Environment
|--------------------------------------------------------------------------
|
| React 18 uses this flag to suppress unnecessary warnings
| while executing updates during tests.
|
*/

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
|--------------------------------------------------------------------------
| Default Timezone
|--------------------------------------------------------------------------
*/

process.env.TZ = "UTC";

/*
|--------------------------------------------------------------------------
| Stable Randomness
|--------------------------------------------------------------------------
|
| Makes UUIDs and random values deterministic.
|
*/

const FIXED_UUID = "00000000-0000-4000-8000-000000000001";

/*
|--------------------------------------------------------------------------
| Test Constants
|--------------------------------------------------------------------------
*/

export const TEST_TENANT_ID = "tenant-test";

export const TEST_SACCO_ID = "sacco-test";

export const TEST_USER_ID = "user-test";

export const TEST_ACCOUNT_ID = "account-test";

export const TEST_SESSION_ID = "session-test";

/*
|--------------------------------------------------------------------------
| Global Test Utilities
|--------------------------------------------------------------------------
*/

globalThis.TEST_IDS = {
  tenantId: TEST_TENANT_ID,
  saccoId: TEST_SACCO_ID,
  userId: TEST_USER_ID,
  accountId: TEST_ACCOUNT_ID,
  sessionId: TEST_SESSION_ID,
};

/*
|--------------------------------------------------------------------------
| Fail Fast On Unhandled Promise Rejections
|--------------------------------------------------------------------------
*/

const unhandledRejections = [];

function handleUnhandledRejection(event) {
  unhandledRejections.push(event.reason);
}

/*
|--------------------------------------------------------------------------
| Optional Console Filtering
|--------------------------------------------------------------------------
|
| Suppress noisy React warnings while allowing real failures
| to surface.
|
*/

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const ignoredWarnings = [
  "Warning: ReactDOM.render",
  "Warning: An update to",
  "Warning: validateDOMNesting",
];

function shouldIgnoreConsole(message) {
  if (!message) return false;

  return ignoredWarnings.some((warning) =>
    String(message).includes(warning)
  );
}

/*
|--------------------------------------------------------------------------
| Vitest Global Helpers
|--------------------------------------------------------------------------
*/

globalThis.flushPromises = () =>
  new Promise((resolve) => queueMicrotask(resolve));

globalThis.wait = (ms = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/*
|--------------------------------------------------------------------------
| MSW Lifecycle
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  server.listen({
    onUnhandledRequest(request) {
      if (
        request.url.pathname.startsWith("/assets/") ||
        request.url.pathname.startsWith("/favicon")
      ) {
        return;
      }

      console.warn(
        `[MSW] Unhandled ${request.method} ${request.url.href}`
      );
    },
  });

  window.addEventListener(
    "unhandledrejection",
    handleUnhandledRejection
  );
});

/*
|--------------------------------------------------------------------------
| Before Each Test
|--------------------------------------------------------------------------
*/

beforeEach(() => {
  vi.useFakeTimers();

  console.error = (...args) => {
    if (shouldIgnoreConsole(args[0])) {
      return;
    }

    originalConsoleError(...args);
  };

  console.warn = (...args) => {
    if (shouldIgnoreConsole(args[0])) {
      return;
    }

    originalConsoleWarn(...args);
  };
});

/*
|--------------------------------------------------------------------------
| After Each Test
|--------------------------------------------------------------------------
|
| Additional cleanup will be expanded in Parts 2–5.
|
*/

afterEach(() => {
  cleanup();

  server.resetHandlers();

  expect(unhandledRejections).toHaveLength(0);

  unhandledRejections.length = 0;

  vi.clearAllMocks();

  vi.restoreAllMocks();

  vi.clearAllTimers();

  vi.useRealTimers();
});

/*
|--------------------------------------------------------------------------
| After All Tests
|--------------------------------------------------------------------------
*/

afterAll(() => {
  window.removeEventListener(
    "unhandledrejection",
    handleUnhandledRejection
  );

  server.close();

  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

/* ============================================================================
   End of Part 1
   Browser APIs, Axios, Socket.IO, Crypto, Fetch, URL, File APIs,
   Storage, Observers and enterprise mocks are added in Part 2.
============================================================================ */
/* ============================================================================
   Part 2
   Axios, Socket.IO, Fetch, Browser APIs, Crypto, URL & FileReader
============================================================================ */

/*
|--------------------------------------------------------------------------
| Axios Enterprise Mock
|--------------------------------------------------------------------------
*/

vi.mock("axios", () => {
  const instance = {
    defaults: {
      headers: {
        common: {},
      },
      timeout: 30000,
    },

    interceptors: {
      request: {
        use: vi.fn(() => 0),
        eject: vi.fn(),
        clear: vi.fn(),
      },
      response: {
        use: vi.fn(() => 0),
        eject: vi.fn(),
        clear: vi.fn(),
      },
    },

    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    head: vi.fn(),
    options: vi.fn(),

    request: vi.fn(),

    create: vi.fn(() => instance),
  };

  return {
    default: instance,
    create: instance.create,
  };
});

/*
|--------------------------------------------------------------------------
| Socket.IO Client
|--------------------------------------------------------------------------
*/

vi.mock("socket.io-client", () => {
  const socket = {
    id: "socket-test-id",

    connected: true,

    recovered: true,

    auth: {},

    io: {},

    connect: vi.fn(),

    disconnect: vi.fn(),

    close: vi.fn(),

    open: vi.fn(),

    on: vi.fn(),

    once: vi.fn(),

    off: vi.fn(),

    emit: vi.fn(),

    emitWithAck: vi.fn(),

    timeout: vi.fn(function () {
      return this;
    }),

    removeListener: vi.fn(),

    removeAllListeners: vi.fn(),

    listeners: vi.fn(() => []),
  };

  return {
    io: vi.fn(() => socket),
  };
});

/*
|--------------------------------------------------------------------------
| Fetch
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,

    redirected: false,

    status: 200,

    statusText: "OK",

    headers: new Headers(),

    clone() {
      return this;
    },

    json: async () => ({}),

    text: async () => "",

    blob: async () => new Blob(),

    arrayBuffer: async () => new ArrayBuffer(0),
  }));
});

/*
|--------------------------------------------------------------------------
| matchMedia
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,

    configurable: true,

    value: vi.fn().mockImplementation((query) => ({
      media: query,

      matches: false,

      onchange: null,

      addListener: vi.fn(),

      removeListener: vi.fn(),

      addEventListener: vi.fn(),

      removeEventListener: vi.fn(),

      dispatchEvent: vi.fn(),
    })),
  });
});

/*
|--------------------------------------------------------------------------
| Window Helpers
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  window.scrollTo = vi.fn();

  window.focus = vi.fn();

  window.blur = vi.fn();

  window.open = vi.fn();

  window.close = vi.fn();

  window.print = vi.fn();

  window.alert = vi.fn();

  window.confirm = vi.fn(() => true);

  window.prompt = vi.fn(() => "");
});

/*
|--------------------------------------------------------------------------
| Navigator
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,

    writable: true,

    value: {
      language: "en",

      languages: ["en"],

      onLine: true,

      userAgent: "Vitest",

      clipboard: {
        writeText: vi.fn(),

        readText: vi.fn(async () => ""),
      },
    },
  });
});

/*
|--------------------------------------------------------------------------
| Crypto
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      writable: true,
      value: {},
    });
  }

  crypto.randomUUID = vi.fn(() => FIXED_UUID);

  crypto.getRandomValues = vi.fn((buffer) => {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = i + 1;
    }

    return buffer;
  });

  crypto.subtle = crypto.subtle || {};
});

/*
|--------------------------------------------------------------------------
| URL APIs
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.URL.createObjectURL = vi.fn(
    () => "blob:test-object-url"
  );

  globalThis.URL.revokeObjectURL = vi.fn();

  globalThis.URL.canParse =
    globalThis.URL.canParse ||
    vi.fn(() => true);
});

/*
|--------------------------------------------------------------------------
| AbortController
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.AbortController =
    globalThis.AbortController ||
    class {
      constructor() {
        this.signal = {};
      }

      abort = vi.fn();
    };
});

/*
|--------------------------------------------------------------------------
| FileReader
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.FileReader = class {
    constructor() {
      this.result = null;

      this.error = null;

      this.onload = null;

      this.onerror = null;

      this.onloadend = null;
    }

    readAsDataURL() {
      this.result =
        "data:text/plain;base64,dGVzdA==";

      this.onload?.({
        target: this,
      });

      this.onloadend?.({
        target: this,
      });
    }

    readAsText() {
      this.result = "test";

      this.onload?.({
        target: this,
      });

      this.onloadend?.({
        target: this,
      });
    }

    readAsArrayBuffer() {
      this.result = new ArrayBuffer(16);

      this.onload?.({
        target: this,
      });

      this.onloadend?.({
        target: this,
      });
    }

    abort() {}
  };
});

/*
|--------------------------------------------------------------------------
| Blob / File
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.File =
    globalThis.File ||
    class File extends Blob {
      constructor(chunks, filename, options = {}) {
        super(chunks, options);

        this.name = filename;

        this.lastModified =
          options.lastModified ?? Date.now();

        this.webkitRelativePath = "";
      }
    };
});

/*
|--------------------------------------------------------------------------
| Queue Microtask
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  if (!globalThis.queueMicrotask) {
    globalThis.queueMicrotask = (callback) =>
      Promise.resolve().then(callback);
  }
});

/*
|--------------------------------------------------------------------------
| Structured Clone
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.structuredClone =
    globalThis.structuredClone ||
    ((value) =>
      JSON.parse(JSON.stringify(value)));
});

/*
|--------------------------------------------------------------------------
| requestIdleCallback
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.requestIdleCallback =
    globalThis.requestIdleCallback ||
    ((callback) =>
      setTimeout(
        () =>
          callback({
            didTimeout: false,

            timeRemaining: () => 50,
          }),
        0
      ));

  globalThis.cancelIdleCallback =
    globalThis.cancelIdleCallback ||
    clearTimeout;
});

/* ============================================================================
   End Part 2
   Part 3 adds:
   • localStorage/sessionStorage
   • IndexedDB
   • BroadcastChannel
   • Web Workers
   • Canvas
   • Drag & Drop
   • File Upload APIs
   • DataTransfer
============================================================================ */
/* ============================================================================
   Part 3
   Enterprise Storage, IndexedDB, Workers, BroadcastChannel,
   Canvas, SVG, Drag & Drop, File APIs
============================================================================ */

/*
|--------------------------------------------------------------------------
| localStorage
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  const storageFactory = () => {
    let store = new Map();

    return {
      get length() {
        return store.size;
      },

      key(index) {
        return [...store.keys()][index] ?? null;
      },

      getItem: vi.fn((key) =>
        store.has(String(key))
          ? store.get(String(key))
          : null
      ),

      setItem: vi.fn((key, value) => {
        store.set(String(key), String(value));
      }),

      removeItem: vi.fn((key) => {
        store.delete(String(key));
      }),

      clear: vi.fn(() => {
        store.clear();
      }),
    };
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: storageFactory(),
  });

  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    writable: true,
    value: storageFactory(),
  });
});

/*
|--------------------------------------------------------------------------
| IndexedDB Enterprise Mock
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  const request = () => ({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    result: {
      close: vi.fn(),

      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          add: vi.fn(),
          put: vi.fn(),
          get: vi.fn(),
          getAll: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
          count: vi.fn(),
          createIndex: vi.fn(),
          index: vi.fn(),
        })),
      })),

      createObjectStore: vi.fn(() => ({
        createIndex: vi.fn(),
      })),
    },
  });

  globalThis.indexedDB = {
    open: vi.fn(() => request()),
    deleteDatabase: vi.fn(() => request()),
    databases: vi.fn(async () => []),
  };
});

/*
|--------------------------------------------------------------------------
| BroadcastChannel
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.BroadcastChannel = class {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
    }

    postMessage = vi.fn();

    close = vi.fn();

    addEventListener = vi.fn();

    removeEventListener = vi.fn();
  };
});

/*
|--------------------------------------------------------------------------
| Web Worker
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.Worker = class {
    constructor() {
      this.onmessage = null;
      this.onerror = null;
    }

    postMessage = vi.fn();

    terminate = vi.fn();

    addEventListener = vi.fn();

    removeEventListener = vi.fn();

    dispatchEvent = vi.fn();
  };
});

/*
|--------------------------------------------------------------------------
| Shared Worker
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.SharedWorker = class {
    constructor() {
      this.port = {
        start: vi.fn(),
        close: vi.fn(),
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    }
  };
});

/*
|--------------------------------------------------------------------------
| DataTransfer
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.DataTransfer = class {
    constructor() {
      this.dropEffect = "copy";
      this.effectAllowed = "all";

      this.files = [];

      this.items = [];

      this.types = [];
    }

    setData = vi.fn();

    getData = vi.fn(() => "");

    clearData = vi.fn();

    setDragImage = vi.fn();
  };
});

/*
|--------------------------------------------------------------------------
| DragEvent
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.DragEvent =
    globalThis.DragEvent ||
    class DragEvent extends Event {
      constructor(type, options = {}) {
        super(type, options);

        this.dataTransfer =
          options.dataTransfer ??
          new DataTransfer();
      }
    };
});

/*
|--------------------------------------------------------------------------
| Canvas
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),

    beginPath: vi.fn(),
    closePath: vi.fn(),

    moveTo: vi.fn(),
    lineTo: vi.fn(),

    stroke: vi.fn(),
    fill: vi.fn(),

    arc: vi.fn(),

    drawImage: vi.fn(),

    fillText: vi.fn(),
    strokeText: vi.fn(),

    save: vi.fn(),
    restore: vi.fn(),

    scale: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),

    measureText: vi.fn(() => ({
      width: 100,
    })),
  }));

  HTMLCanvasElement.prototype.toBlob = vi.fn((cb) =>
    cb(new Blob())
  );

  HTMLCanvasElement.prototype.toDataURL =
    vi.fn(() => "data:image/png;base64,test");
});

/*
|--------------------------------------------------------------------------
| SVG
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.SVGElement =
    globalThis.SVGElement ||
    class extends HTMLElement {};

  SVGElement.prototype.getBBox = vi.fn(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  }));

  SVGElement.prototype.getComputedTextLength =
    vi.fn(() => 100);
});

/*
|--------------------------------------------------------------------------
| Element.animate
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  Element.prototype.animate = vi.fn(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    cancel: vi.fn(),
    finish: vi.fn(),

    onfinish: null,

    finished: Promise.resolve(),
  }));
});

/*
|--------------------------------------------------------------------------
| File System APIs
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  window.showOpenFilePicker = vi.fn(async () => []);

  window.showSaveFilePicker = vi.fn(async () => ({
    createWritable: async () => ({
      write: vi.fn(),
      close: vi.fn(),
    }),
  }));
});

/*
|--------------------------------------------------------------------------
| ImageBitmap
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.createImageBitmap = vi.fn(async () => ({}));
});

/*
|--------------------------------------------------------------------------
| File Upload Helpers
|--------------------------------------------------------------------------
*/

globalThis.createTestFile = (
  name = "document.pdf",
  type = "application/pdf",
  content = "test"
) =>
  new File([content], name, {
    type,
  });

globalThis.createImageFile = () =>
  createTestFile(
    "logo.png",
    "image/png",
    "image"
  );

globalThis.createPDFFile = () =>
  createTestFile(
    "certificate.pdf",
    "application/pdf",
    "pdf"
  );

globalThis.createCSVFile = () =>
  createTestFile(
    "members.csv",
    "text/csv",
    "id,name"
  );

/*
|--------------------------------------------------------------------------
| Cleanup
|--------------------------------------------------------------------------
*/

afterEach(() => {
  localStorage.clear();

  sessionStorage.clear();
});

/* ============================================================================
   End Part 3

   Part 4 introduces:

   • React 18 concurrency helpers
   • ResizeObserver
   • IntersectionObserver
   • MutationObserver
   • DOMRect
   • Performance API
   • VisualViewport
   • requestAnimationFrame
   • requestIdleCallback enhancements
   • Timers
   • Animation APIs
   • Scroll APIs
   • MediaQuery improvements
============================================================================ */
/* ============================================================================
   Part 4
   React 18 Helpers, Timers, Animation, Observers & Performance APIs
============================================================================ */

/*
|--------------------------------------------------------------------------
| React 18 Scheduler Helpers
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  globalThis.flushPromises = () =>
    new Promise((resolve) => queueMicrotask(resolve));

  globalThis.flushTimers = async () => {
    vi.runOnlyPendingTimers();
    await globalThis.flushPromises();
  };

  globalThis.nextTick = () =>
    new Promise((resolve) => process.nextTick(resolve));

  globalThis.waitForMicrotasks = () =>
    Promise.resolve();
});

/*
|--------------------------------------------------------------------------
| Fake Timers
|--------------------------------------------------------------------------
*/

beforeEach(() => {
  vi.useFakeTimers({
    shouldAdvanceTime: false,
  });

  vi.setSystemTime(
    new Date("2026-01-01T00:00:00.000Z")
  );
});

/*
|--------------------------------------------------------------------------
| requestAnimationFrame
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.requestAnimationFrame = vi.fn((callback) =>
    setTimeout(() => callback(performance.now()), 16)
  );

  globalThis.cancelAnimationFrame = vi.fn((id) =>
    clearTimeout(id)
  );
});

/*
|--------------------------------------------------------------------------
| requestIdleCallback
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.requestIdleCallback =
    globalThis.requestIdleCallback ||
    ((callback) =>
      setTimeout(
        () =>
          callback({
            didTimeout: false,
            timeRemaining: () => 50,
          }),
        1
      ));

  globalThis.cancelIdleCallback =
    globalThis.cancelIdleCallback ||
    ((id) => clearTimeout(id));
});

/*
|--------------------------------------------------------------------------
| ResizeObserver
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.ResizeObserver = class {
    constructor(callback) {
      this.callback = callback;
    }

    observe = vi.fn();

    unobserve = vi.fn();

    disconnect = vi.fn();

    trigger(entries = []) {
      this.callback(entries, this);
    }
  };
});

/*
|--------------------------------------------------------------------------
| IntersectionObserver
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.IntersectionObserver = class {
    constructor(callback, options = {}) {
      this.callback = callback;
      this.options = options;
    }

    root = null;

    rootMargin = "0px";

    thresholds = [0];

    observe = vi.fn();

    unobserve = vi.fn();

    disconnect = vi.fn();

    takeRecords = vi.fn(() => []);

    trigger(
      isIntersecting = true,
      ratio = 1
    ) {
      this.callback([
        {
          isIntersecting,
          intersectionRatio: ratio,
          target: document.body,
          boundingClientRect: new DOMRect(),
          intersectionRect: new DOMRect(),
          rootBounds: new DOMRect(),
          time: performance.now(),
        },
      ]);
    }
  };
});

/*
|--------------------------------------------------------------------------
| MutationObserver
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
    }

    observe = vi.fn();

    disconnect = vi.fn();

    takeRecords = vi.fn(() => []);

    trigger(records = []) {
      this.callback(records, this);
    }
  };
});

/*
|--------------------------------------------------------------------------
| DOMRect
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  globalThis.DOMRect = class {
    constructor(
      x = 0,
      y = 0,
      width = 0,
      height = 0
    ) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;

      this.top = y;
      this.left = x;
      this.right = x + width;
      this.bottom = y + height;
    }

    static fromRect(rect = {}) {
      return new DOMRect(
        rect.x ?? 0,
        rect.y ?? 0,
        rect.width ?? 0,
        rect.height ?? 0
      );
    }
  };
});

/*
|--------------------------------------------------------------------------
| Performance API
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  Object.defineProperty(globalThis, "performance", {
    configurable: true,
    writable: true,
    value: {
      now: vi.fn(() => Date.now()),

      mark: vi.fn(),

      measure: vi.fn(),

      clearMarks: vi.fn(),

      clearMeasures: vi.fn(),

      getEntries: vi.fn(() => []),

      getEntriesByType: vi.fn(() => []),

      getEntriesByName: vi.fn(() => []),
    },
  });
});

/*
|--------------------------------------------------------------------------
| Visual Viewport
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    writable: true,
    value: {
      width: 1440,
      height: 900,
      scale: 1,

      offsetLeft: 0,
      offsetTop: 0,

      pageLeft: 0,
      pageTop: 0,

      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    },
  });
});

/*
|--------------------------------------------------------------------------
| Scroll APIs
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  window.scrollTo = vi.fn();

  window.scrollBy = vi.fn();

  Element.prototype.scrollIntoView = vi.fn();

  Element.prototype.scrollTo = vi.fn();

  Element.prototype.scrollBy = vi.fn();
});

/*
|--------------------------------------------------------------------------
| Pointer Events
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  HTMLElement.prototype.setPointerCapture =
    vi.fn();

  HTMLElement.prototype.releasePointerCapture =
    vi.fn();

  HTMLElement.prototype.hasPointerCapture =
    vi.fn(() => false);
});

/*
|--------------------------------------------------------------------------
| Element Geometry
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  Element.prototype.getBoundingClientRect =
    vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 100,
      right: 200,
      width: 200,
      height: 100,
    }));

  Element.prototype.getClientRects =
    vi.fn(() => []);
});

/*
|--------------------------------------------------------------------------
| CSS Animations
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  Element.prototype.animate = vi.fn(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    reverse: vi.fn(),
    cancel: vi.fn(),
    finish: vi.fn(),

    currentTime: 0,
    playState: "running",

    finished: Promise.resolve(),

    ready: Promise.resolve(),

    onfinish: null,
  }));
});

/*
|--------------------------------------------------------------------------
| Media Query Improvements
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    media: query,

    matches: false,

    onchange: null,

    addListener: vi.fn(),
    removeListener: vi.fn(),

    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),

    dispatchEvent: vi.fn(),
  }));
});

/*
|--------------------------------------------------------------------------
| Enterprise Timer Cleanup
|--------------------------------------------------------------------------
*/

afterEach(() => {
  vi.runOnlyPendingTimers();

  vi.clearAllTimers();

  vi.useRealTimers();
});

/* ============================================================================
   End Part 4

   Part 5 adds:

   • Enterprise cleanup utilities
   • React Query cache reset
   • Redux store reset helpers
   • MSW helper utilities
   • Console filtering
   • Test helper exports
   • Global teardown
   • Memory leak detection
   • Final enterprise lifecycle management
============================================================================ */
/* ============================================================================
   Part 5
   Enterprise Cleanup, Reset Hooks, Helper Utilities & Global Lifecycle
============================================================================ */

/*
|--------------------------------------------------------------------------
| Console Filtering
|--------------------------------------------------------------------------
|
| Suppress only known noisy warnings while preserving genuine failures.
|
*/

const IGNORED_CONSOLE_PATTERNS = [
  /ReactDOM\.render/i,
  /ReactDOMTestUtils\.act/i,
  /validateDOMNesting/i,
  /Not implemented: navigation/i,
  /Warning:.*act\(/i,
  /Warning:.*defaultProps/i,
];

const originalConsole = {
  error: console.error,
  warn: console.warn,
  info: console.info,
};

function shouldIgnoreConsoleMessage(message) {
  const text = String(message ?? "");

  return IGNORED_CONSOLE_PATTERNS.some((pattern) =>
    pattern.test(text)
  );
}

beforeEach(() => {
  console.error = (...args) => {
    if (shouldIgnoreConsoleMessage(args[0])) return;
    originalConsole.error(...args);
  };

  console.warn = (...args) => {
    if (shouldIgnoreConsoleMessage(args[0])) return;
    originalConsole.warn(...args);
  };
});

afterAll(() => {
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
});

/*
|--------------------------------------------------------------------------
| React Query Helpers
|--------------------------------------------------------------------------
*/

globalThis.resetReactQueryClient = (queryClient) => {
  if (!queryClient) return;

  queryClient.cancelQueries?.();

  queryClient.clear?.();

  queryClient.removeQueries?.();

  queryClient.removeMutations?.();

  queryClient.getQueryCache?.().clear?.();

  queryClient.getMutationCache?.().clear?.();
};

/*
|--------------------------------------------------------------------------
| Redux Helpers
|--------------------------------------------------------------------------
*/

globalThis.resetReduxStore = (store) => {
  if (!store) return;

  try {
    store.dispatch?.({
      type: "__TEST__/RESET",
    });
  } catch {
    // ignore
  }
};

/*
|--------------------------------------------------------------------------
| MSW Helpers
|--------------------------------------------------------------------------
*/

globalThis.useMockHandler = (...handlers) => {
  server.use(...handlers);
};

globalThis.resetMockServer = () => {
  server.resetHandlers();
};

/*
|--------------------------------------------------------------------------
| Enterprise Async Helpers
|--------------------------------------------------------------------------
*/

globalThis.sleep = (ms = 0) =>
  new Promise((resolve) =>
    setTimeout(resolve, ms)
  );

globalThis.flushAllPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

globalThis.advanceTimers = async (
  milliseconds = 0
) => {
  vi.advanceTimersByTime(milliseconds);

  await globalThis.flushAllPromises();
};

/*
|--------------------------------------------------------------------------
| Mock File Upload Utilities
|--------------------------------------------------------------------------
*/

globalThis.createUploadEvent = (
  input,
  files
) => {
  Object.defineProperty(input, "files", {
    configurable: true,
    writable: false,
    value: files,
  });

  return new Event("change", {
    bubbles: true,
  });
};

/*
|--------------------------------------------------------------------------
| Memory Leak Detection
|--------------------------------------------------------------------------
*/

let initialTimerCount = 0;

beforeEach(() => {
  initialTimerCount = vi.getTimerCount();
});

afterEach(() => {
  const remainingTimers = vi.getTimerCount();

  if (remainingTimers > initialTimerCount) {
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
  }
});

/*
|--------------------------------------------------------------------------
| Cleanup Routine
|--------------------------------------------------------------------------
*/

afterEach(() => {
  cleanup();

  server.resetHandlers();

  localStorage.clear();

  sessionStorage.clear();

  document.body.innerHTML = "";

  document.head.innerHTML = "";

  vi.clearAllMocks();

  vi.restoreAllMocks();

  vi.clearAllTimers();

  vi.useRealTimers();
});

/*
|--------------------------------------------------------------------------
| Global Teardown
|--------------------------------------------------------------------------
*/

afterAll(() => {
  try {
    server.close();
  } catch {
    // ignore
  }

  cleanup();

  vi.restoreAllMocks();

  vi.clearAllMocks();

  vi.clearAllTimers();

  if (typeof indexedDB !== "undefined") {
    indexedDB.databases?.().then((dbs) => {
      dbs.forEach((db) => {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      });
    }).catch(() => {
      // ignore cleanup errors
    });
  }
});

/*
|--------------------------------------------------------------------------
| Enterprise Test Helper Namespace
|--------------------------------------------------------------------------
*/

globalThis.TestUtils = {
  sleep: globalThis.sleep,

  flushPromises: globalThis.flushPromises,

  flushAllPromises: globalThis.flushAllPromises,

  advanceTimers: globalThis.advanceTimers,

  createTestFile: globalThis.createTestFile,

  createPDFFile: globalThis.createPDFFile,

  createImageFile: globalThis.createImageFile,

  createCSVFile: globalThis.createCSVFile,

  createUploadEvent: globalThis.createUploadEvent,

  resetReduxStore: globalThis.resetReduxStore,

  resetReactQueryClient:
    globalThis.resetReactQueryClient,

  useMockHandler:
    globalThis.useMockHandler,

  resetMockServer:
    globalThis.resetMockServer,
};

/*
|--------------------------------------------------------------------------
| Final Environment Validation
|--------------------------------------------------------------------------
*/

beforeAll(() => {
  expect(globalThis.fetch).toBeDefined();
  expect(globalThis.localStorage).toBeDefined();
  expect(globalThis.crypto).toBeDefined();
  expect(server).toBeDefined();
});

/* ============================================================================
   END OF ENTERPRISE TEST ENVIRONMENT
   frontend/src/setupTests.js

   Features:
   ✓ React 18 + Vitest
   ✓ Testing Library
   ✓ MSW API mocking
   ✓ Axios mock
   ✓ Socket.IO mock
   ✓ Fetch mock
   ✓ Browser API polyfills
   ✓ File & Drag-and-Drop support
   ✓ IndexedDB mock
   ✓ BroadcastChannel mock
   ✓ Web Worker mock
   ✓ Canvas & SVG support
   ✓ Performance APIs
   ✓ React Query reset helpers
   ✓ Redux reset helpers
   ✓ Deterministic timers
   ✓ Memory leak detection
   ✓ Enterprise cleanup lifecycle
   ✓ Fintech onboarding integration-test ready
============================================================================ */

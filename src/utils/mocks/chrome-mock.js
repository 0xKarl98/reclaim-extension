// Chrome API mock for testing environment
const chromeMock = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(() => false)
    },
    sendMessage: jest.fn((message, callback) => {
      if (callback) {
        setTimeout(() => callback({ success: true }), 0);
      }
      return Promise.resolve({ success: true });
    }),
    connect: jest.fn(() => ({
      postMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      },
      onDisconnect: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      },
      disconnect: jest.fn()
    })),
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
    id: 'test-extension-id'
  },
  offscreen: {
    createDocument: jest.fn(() => Promise.resolve()),
    closeDocument: jest.fn(() => Promise.resolve()),
    hasDocument: jest.fn(() => Promise.resolve(false))
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([])),
    sendMessage: jest.fn(() => Promise.resolve({ success: true })),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve())
    },
    session: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve())
    }
  },
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onHeadersReceived: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  cookies: {
    get: jest.fn(() => Promise.resolve(null)),
    getAll: jest.fn(() => Promise.resolve([])),
    set: jest.fn(() => Promise.resolve()),
    remove: jest.fn(() => Promise.resolve())
  }
};

// Make chrome available globally in test environment
if (typeof global !== 'undefined') {
  global.chrome = chromeMock;
}

if (typeof window !== 'undefined') {
  window.chrome = chromeMock;
}

module.exports = chromeMock;
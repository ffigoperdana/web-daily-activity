import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerServiceWorker, onUpdateAvailable, applyUpdate } from './register';
describe('sw/register', () => {
  let originalNavigator;
  let originalLocation;
  beforeEach(() => {
    originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    }
    if (originalLocation) {
      Object.defineProperty(window, 'location', originalLocation);
    }
  });
  describe('registerServiceWorker', () => {
    it('does nothing when serviceWorker is not supported', () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true,
      });
      // Should not throw
      expect(() => registerServiceWorker()).not.toThrow();
    });
    it('registers SW with /sw.js and scope /', async () => {
      const mockRegistration = {
        waiting: null,
        installing: null,
        addEventListener: vi.fn(),
      };
      const registerFn = vi.fn().mockResolvedValue(mockRegistration);
      const addEventListenerFn = vi.fn();
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: {
            register: registerFn,
            addEventListener: addEventListenerFn,
            controller: null,
          },
        },
        writable: true,
        configurable: true,
      });
      registerServiceWorker();
      expect(registerFn).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    });
    it('notifies listeners when a waiting SW is found on registration', async () => {
      const mockWaiting = { postMessage: vi.fn() };
      const mockRegistration = {
        waiting: mockWaiting,
        installing: null,
        addEventListener: vi.fn(),
      };
      const registerFn = vi.fn().mockResolvedValue(mockRegistration);
      const addEventListenerFn = vi.fn();
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: {
            register: registerFn,
            addEventListener: addEventListenerFn,
            controller: {},
          },
        },
        writable: true,
        configurable: true,
      });
      const cb = vi.fn();
      onUpdateAvailable(cb);
      registerServiceWorker();
      // Wait for the promise to resolve
      await vi.waitFor(() => {
        expect(cb).toHaveBeenCalled();
      });
    });
    it('notifies listeners when updatefound fires and new SW installs', async () => {
      let updateFoundHandler = null;
      let stateChangeHandler = null;
      const mockInstalling = {
        state: 'installing',
        addEventListener: vi.fn((event, handler) => {
          if (event === 'statechange') {
            stateChangeHandler = handler;
          }
        }),
      };
      const mockRegistration = {
        waiting: null,
        installing: null,
        addEventListener: vi.fn((event, handler) => {
          if (event === 'updatefound') {
            updateFoundHandler = handler;
          }
        }),
      };
      const registerFn = vi.fn().mockResolvedValue(mockRegistration);
      const addEventListenerFn = vi.fn();
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: {
            register: registerFn,
            addEventListener: addEventListenerFn,
            controller: {}, // existing controller means this is an update
          },
        },
        writable: true,
        configurable: true,
      });
      const cb = vi.fn();
      onUpdateAvailable(cb);
      registerServiceWorker();
      // Wait for registration promise to resolve
      await vi.waitFor(() => {
        expect(mockRegistration.addEventListener).toHaveBeenCalledWith(
          'updatefound',
          expect.any(Function),
        );
      });
      // Simulate updatefound
      mockRegistration.installing = mockInstalling;
      updateFoundHandler();
      expect(stateChangeHandler).not.toBeNull();
      // Simulate the installing SW transitioning to 'installed'
      mockInstalling.state = 'installed';
      stateChangeHandler();
      expect(cb).toHaveBeenCalled();
    });
  });
  describe('onUpdateAvailable', () => {
    it('returns an unsubscribe function', () => {
      const cb = vi.fn();
      const unsub = onUpdateAvailable(cb);
      expect(typeof unsub).toBe('function');
      unsub();
      // After unsubscribe, callback should not be called on future updates
    });
  });
  describe('applyUpdate', () => {
    it('posts SKIP_WAITING to the waiting SW and reloads', async () => {
      const mockWaiting = { postMessage: vi.fn() };
      const mockRegistration = {
        waiting: mockWaiting,
        installing: null,
        addEventListener: vi.fn(),
      };
      const registerFn = vi.fn().mockResolvedValue(mockRegistration);
      const addEventListenerFn = vi.fn();
      const reloadFn = vi.fn();
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          serviceWorker: {
            register: registerFn,
            addEventListener: addEventListenerFn,
            controller: {},
          },
        },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'location', {
        value: { reload: reloadFn },
        writable: true,
        configurable: true,
      });
      // Register first to set up waitingRegistration
      registerServiceWorker();
      await vi.waitFor(() => {
        expect(registerFn).toHaveBeenCalled();
      });
      // Now call applyUpdate
      applyUpdate();
      expect(mockWaiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      expect(reloadFn).toHaveBeenCalled();
    });
  });
});
//# sourceMappingURL=register.test.js.map

import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
window.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));
window.scrollTo = vi.fn();
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};

import React, { useContext } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fontMocks, firebaseBoundary } = vi.hoisted(() => ({
  fontMocks: {
    Geist: vi.fn((options) => ({ variable: options.variable.replace('--', 'mock-') })),
    GeistMono: vi.fn((options) => ({ variable: options.variable.replace('--', 'mock-') })),
  },
  firebaseBoundary: {
    onAuthStateChanged: vi.fn(),
    doc: vi.fn((_db, ...segments) => ({
      type: 'doc',
      path: segments.join('/'),
      id: String(segments.at(-1) ?? ''),
    })),
    getDoc: vi.fn(),
    getDocs: vi.fn(async () => ({ docs: [] })),
    onSnapshot: vi.fn(() => vi.fn()),
    setDoc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
    writeBatch: vi.fn(() => ({ commit: vi.fn(), set: vi.fn() })),
    updateDoc: vi.fn(),
  },
}));

vi.mock('next/font/google', () => ({
  Geist: fontMocks.Geist,
  Geist_Mono: fontMocks.GeistMono,
}));

vi.mock('next/link', () => ({
  /**
   * jsdom-safe replacement for next/link; keeps real anchor semantics.
   * @param {object} props - Link props.
   * @param {string} props.href - Destination URL.
   * @param {import('react').ReactNode} props.children - Link children.
   * @returns {import('react').ReactElement} Anchor element.
   */
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  /**
   * jsdom-safe replacement for next/image.
   * @param {object} props - Image props.
   * @param {string} props.src - Image source.
   * @param {string} props.alt - Accessible image name.
   * @returns {import('react').ReactElement} Plain img element.
   */
  default: ({ src, alt, ...rest }) => <img src={src} alt={alt} {...rest} />,
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
}));

vi.mock('firebase/auth', () => ({
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(() => ({ name: 'test-auth' })),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
    this.setCustomParameters = vi.fn();
  }),
  onAuthStateChanged: firebaseBoundary.onAuthStateChanged,
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db, ...segments) => ({ type: 'collection', path: segments.join('/') })),
  connectFirestoreEmulator: vi.fn(),
  doc: firebaseBoundary.doc,
  getDoc: firebaseBoundary.getDoc,
  getDocs: firebaseBoundary.getDocs,
  getFirestore: vi.fn(() => ({ name: 'test-db' })),
  limit: vi.fn((count) => ({ type: 'limit', count })),
  onSnapshot: firebaseBoundary.onSnapshot,
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((source, ...constraints) => ({ source, constraints })),
  serverTimestamp: firebaseBoundary.serverTimestamp,
  setDoc: firebaseBoundary.setDoc,
  startAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  updateDoc: firebaseBoundary.updateDoc,
  where: vi.fn((field, operator, value) => ({ type: 'where', field, operator, value })),
  writeBatch: firebaseBoundary.writeBatch,
}));

vi.mock('firebase/storage', () => ({
  connectStorageEmulator: vi.fn(),
  getStorage: vi.fn(() => ({ name: 'test-storage' })),
}));

/**
 * @typedef {Awaited<ReturnType<typeof importRootLayoutModules>>} RootLayoutModules
 */

/**
 * Import root layout and provider context modules after stubbing the site URL.
 * @param {string} siteUrl - Site URL value to expose to the layout module.
 * @returns {Promise<{
 *   RootLayout: typeof import('@/app/layout').default,
 *   metadata: typeof import('@/app/layout').metadata,
 *   useToast: typeof import('@/runtime/providers/ToastProvider').useToast,
 *   NotificationContext: typeof import('@/runtime/providers/NotificationProvider').NotificationContext,
 * }>} Imported modules from the same module graph.
 */
async function importRootLayoutModules(siteUrl) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', siteUrl);

  const [layoutModule, toastModule, notificationModule] = await Promise.all([
    import('@/app/layout'),
    import('@/runtime/providers/ToastProvider'),
    import('@/runtime/providers/NotificationProvider'),
  ]);

  return {
    RootLayout: layoutModule.default,
    metadata: layoutModule.metadata,
    useToast: toastModule.useToast,
    NotificationContext: notificationModule.NotificationContext,
  };
}

/**
 * Create a child component that proves RootLayout providers wrap page content.
 * @param {Pick<RootLayoutModules, 'useToast' | 'NotificationContext'>} modules - Provider modules.
 * @returns {() => React.JSX.Element} Probe component.
 */
function createRootLayoutProbe({ useToast, NotificationContext }) {
  return function RootLayoutProbe() {
    const toast = useToast();
    const notification = useContext(NotificationContext);

    return (
      <main aria-label="root layout child">
        <button type="button" onClick={() => toast.showToast('Root layout toast', 'info')}>
          顯示 root toast
        </button>
        <output aria-label="toast shell">
          {typeof toast.showToast === 'function' && Array.isArray(toast.toasts)
            ? 'mounted'
            : 'missing'}
        </output>
        <output aria-label="notification shell">
          {typeof notification.togglePanel === 'function' ? 'mounted' : 'missing'}
        </output>
      </main>
    );
  };
}

/**
 * Render RootLayout and parse the static shell document.
 * @param {RootLayoutModules} modules - Imported RootLayout modules.
 * @returns {Document} Parsed shell document.
 */
function createStaticShellDocument({ RootLayout, useToast, NotificationContext }) {
  const RootLayoutProbe = createRootLayoutProbe({ useToast, NotificationContext });
  const view = renderToStaticMarkup(
    <RootLayout>
      <RootLayoutProbe />
    </RootLayout>,
  );

  return new DOMParser().parseFromString(`<!doctype html>${view}`, 'text/html');
}

describe('RootLayout app shell contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firebaseBoundary.onAuthStateChanged.mockImplementation((_auth, callback) => {
      callback(null);
      return vi.fn();
    });

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('exports metadata with the configured site URL', async () => {
    const { metadata } = await importRootLayoutModules('https://run.example.test/base');

    expect(metadata.metadataBase).toBeInstanceOf(URL);
    expect(metadata.metadataBase.href).toBe('https://run.example.test/base');
    expect(metadata).toMatchObject({
      title: 'Dive Into Run',
      description: 'Dive Into Run 跑步社群平台',
      openGraph: {
        siteName: 'Dive Into Run',
        type: 'website',
      },
    });
  });

  it('exports metadata with the localhost fallback site URL', async () => {
    const { metadata } = await importRootLayoutModules('');

    expect(metadata.metadataBase.href).toBe('http://localhost:3000/');
  });

  it('renders the html/body shell, children, providers, nav, and toast shell', async () => {
    const modules = await importRootLayoutModules('https://run.example.test');
    const shellDocument = createStaticShellDocument(modules);

    expect(shellDocument.documentElement.getAttribute('lang')).toBe('zh-Hant-TW');
    expect(Array.from(shellDocument.body.classList)).toEqual(
      expect.arrayContaining(['mock-font-geist-sans', 'mock-font-geist-mono', 'antialiased']),
    );
    expect(shellDocument.body.querySelector('nav[aria-label="主要導覽"]')).not.toBeNull();
    expect(shellDocument.body.querySelector('main[aria-label="root layout child"]')).not.toBeNull();
    expect(shellDocument.body.querySelector('[aria-label="toast shell"]')?.textContent).toBe(
      'mounted',
    );
    expect(shellDocument.body.querySelector('[aria-label="notification shell"]')?.textContent).toBe(
      'mounted',
    );
    expect(shellDocument.body.querySelector('a.brand')?.getAttribute('href')).toBe('/');
  });
});

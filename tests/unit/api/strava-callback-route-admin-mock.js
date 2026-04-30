import { vi } from 'vitest';

const adminMock = vi.hoisted(() => {
  const docs = new Map();
  const verifyIdToken = vi.fn();
  const serverTimestamp = vi.fn(() => ({ __type: 'serverTimestamp' }));
  const timestampFromDate = vi.fn((date) => ({ toDate: () => date }));
  const writeDoc = (path, data, merge = false) => {
    const previous = docs.get(path);
    docs.set(path, merge && previous ? { ...previous, ...data } : { ...data });
  };
  const createDocRef = (path) => ({
    id: path.split('/').at(-1),
    path,
    get: async () => {
      const data = docs.get(path);
      return { id: path.split('/').at(-1), exists: data !== undefined, data: () => data };
    },
    set: async (data, options) => writeDoc(path, data, Boolean(options?.merge)),
    update: async (data) => writeDoc(path, data, true),
    delete: async () => docs.delete(path),
  });
  const listDocs = (path) => {
    const prefix = `${path}/`;

    return [...docs.entries()]
      .filter(([docPath]) => docPath.startsWith(prefix) && !docPath.slice(prefix.length).includes('/'))
      .map(([docPath, data]) => ({
        id: docPath.split('/').at(-1),
        exists: true,
        data: () => data,
        ref: createDocRef(docPath),
      }));
  };
  const createQuery = (path, filters = [], limit = Number.POSITIVE_INFINITY) => ({
    where(field, operator, value) {
      return createQuery(path, [...filters, { field, operator, value }], limit);
    },
    limit(value) {
      return createQuery(path, filters, value);
    },
    async get() {
      let matches = listDocs(path);
      for (const filter of filters) {
        matches = matches.filter(
          (doc) => filter.operator === '==' && doc.data()?.[filter.field] === filter.value,
        );
      }

      const result = matches.slice(0, limit);
      return { empty: result.length === 0, size: result.length, docs: result };
    },
  });
  const createBatch = () => {
    const operations = [];
    const apply = (operation) => {
      if (operation.type === 'delete') {
        docs.delete(operation.ref.path);
        return;
      }

      writeDoc(
        operation.ref.path,
        operation.data,
        operation.type === 'update' || Boolean(operation.options?.merge),
      );
    };

    return {
      set: vi.fn((ref, data, options) => operations.push({ type: 'set', ref, data, options })),
      update: vi.fn((ref, data) => operations.push({ type: 'update', ref, data })),
      delete: vi.fn((ref) => operations.push({ type: 'delete', ref })),
      commit: vi.fn(async () => operations.forEach(apply)),
    };
  };
  const firestore = Object.assign(
    () => ({
      collection: vi.fn((path) => ({
        path,
        doc: (id) => createDocRef(`${path}/${id}`),
        where: (field, operator, value) => createQuery(path, [{ field, operator, value }]),
        limit: (value) => createQuery(path, [], value),
        get: () => createQuery(path).get(),
      })),
      batch: vi.fn(() => createBatch()),
    }),
    {
      FieldValue: { serverTimestamp },
      Timestamp: { fromDate: timestampFromDate },
    },
  );

  return {
    verifyIdToken,
    firestore,
    reset() {
      docs.clear();
      verifyIdToken.mockReset();
      serverTimestamp.mockClear();
      timestampFromDate.mockClear();
    },
    readDoc: (path) => docs.get(path),
    seedDoc: (path, data) => docs.set(path, data),
  };
});

/** Installs the top-level firebase-admin module mock used by the route tests. */
vi.mock('firebase-admin', () => ({
  default: {
    apps: [],
    initializeApp: vi.fn(),
    credential: {
      applicationDefault: vi.fn(),
      cert: vi.fn(),
    },
    auth: () => ({ verifyIdToken: adminMock.verifyIdToken }),
    firestore: adminMock.firestore,
  },
}));

export default adminMock;

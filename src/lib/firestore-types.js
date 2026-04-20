// Re-export Firestore types so UI layer does not depend on firebase/firestore directly.
// eslint-disable-next-line import/prefer-default-export -- type-barrel re-export mirroring SDK named API
export { Timestamp } from 'firebase/firestore';

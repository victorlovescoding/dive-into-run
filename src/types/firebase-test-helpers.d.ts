import type { Auth } from 'firebase/auth';

declare global {
  interface Window {
    testFirebaseHelpers?: {
      auth: Auth;
      signIn: typeof import('firebase/auth').signInWithEmailAndPassword;
      signOut: typeof import('firebase/auth').signOut;
    };
  }
}

export {};

/**
 * Global Window type augmentation for E2E tests with Firebase Emulator.
 * Declared here so TypeScript can find it when type-checking the E2E spec.
 */
interface Window {
  testFirebaseHelpers: {
    auth: unknown;
    signIn: (auth: unknown, email: string, password: string) => Promise<unknown>;
  };
}

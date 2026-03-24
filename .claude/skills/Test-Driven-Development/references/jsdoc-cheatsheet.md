/**
 * @file JSDoc Cheatsheet for TypeScript (checkJs: true)
 * @description
 * This project uses TypeScript's JSDoc Check (`checkJs: true`).
 * We prefer "TypeScript JSDoc Syntax" over "Google Closure Syntax" for better VS Code integration.
 * 
 * References:
 * - JSDoc Support: https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html
 * - checkJs Option: https://www.typescriptlang.org/tsconfig#checkJs
 */

/* ==========================================================================
   1. FUNCTION TYPES (CALLBACKS)
   Preferred: TypeScript Syntax (Arrow Functions)
   ========================================================================== */

/**
 * @callback UpdateCallback
 * @param {string} id
 * @returns {void}
 */

/**
 * RECOMMENDED: TypeScript Syntax (Readable, Supported in VS Code)
 * @param {(id: string) => void} onUpdate
 */

/**
 * ALSO VALID: Google Closure Syntax (Verbose)
 * @param {function(string): void} onUpdateOld
 */

/* ==========================================================================
   2. OBJECT TYPES & TYPEDEF
   ========================================================================== */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} [email] - Optional property
 */

/**
 * @param {User} user
 */
function processUser(user) {
  // ...
}

/* ==========================================================================
   3. OBJECT DESTRUCTURING IN @PARAM
   ========================================================================== */

/**
 * Component Props example
 * @param {Object} props
 * @param {User} props.user
 * @param {(id: string) => void} props.onUpdate
 */
function UserProfile({ user, onUpdate }) {
    // ...
}

/* ==========================================================================
   4. IMPORTING TYPES
   ========================================================================== */

/**
 * @param {import('./other-file').SomeType} data
 */

/* ==========================================================================
   5. CASTING (TYPE ASSERTION)
   ========================================================================== */

const myValue = /** @type {string} */ (someAnyValue);

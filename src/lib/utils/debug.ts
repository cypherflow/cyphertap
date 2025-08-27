
import debug from 'debug';
import { BROWSER as browser } from 'esm-env';

// Root namespace for your app
const APP_NAMESPACE = 'ct';

/**
 * Create a debug logger with namespaced levels
 */
export const createDebug = (namespace: string) => {
  // Create the base debugger
  const baseDebug = debug(`${APP_NAMESPACE}:${namespace}`);

  return {
    // Standard log function
    log: baseDebug,

    // Warning and error levels
    warn: baseDebug.extend('warn'),
    error: baseDebug.extend('error'),

    // Allow creating subnamespaces
    extend: (subNamespace: string) => createDebug(`${namespace}:${subNamespace}`)
  };
};

/**
 * Initialize debug settings from localStorage on app start
 */
export const initDebug = () => {
  if (browser && localStorage.debug) {
    debug.enable(localStorage.debug);
    console.log(`Debug initialized with settings: ${localStorage.debug}`);
  }
};

// Export the original debug instance for advanced use cases
export { debug };

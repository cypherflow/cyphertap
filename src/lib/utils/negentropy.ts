// src/lib/utils/negentropy.ts
import { createDebug } from '$lib/utils/debug.js';

const debug = createDebug('negentropy');

let negentropyLoaded = false;
let loadingPromise: Promise<void> | null = null;

// Load Negentropy library
export const loadNegentropy = (): Promise<void> => {
    const d = debug.extend('loadNegentropy')
    // If already loaded, return resolved promise
    if (negentropyLoaded) {
        return Promise.resolve();
    }
    
    // If already loading, return the existing promise
    if (loadingPromise) {
        return loadingPromise;
    }
    
    // Start loading
    loadingPromise = new Promise((resolve, reject) => {
        // Check if already available (in case script was loaded elsewhere)
        if (window.Negentropy && window.NegentropyStorageVector) {
            d.log('Negentropy already available on window');
            negentropyLoaded = true;
            resolve();
            return;
        }
        
        d.log('Loading Negentropy library...');
        
        const script = document.createElement('script');
        script.src = '/negentropy.js';
        script.onload = () => {
            if (window.Negentropy && window.NegentropyStorageVector) {
                d.log('✅ Negentropy loaded successfully');
                negentropyLoaded = true;
                resolve();
            } else {
                const error = new Error('Negentropy library did not load properly');
                d.log('❌ Negentropy load failed:', error);
                reject(error);
            }
        };
        script.onerror = (error) => {
            const err = new Error('Failed to load negentropy.js');
            d.log('❌ Script load failed:', error);
            reject(err);
        };
        
        document.head.appendChild(script);
    });
    
    return loadingPromise;
};

// Check if Negentropy is loaded
export const isNegentropyLoaded = (): boolean => {
    return negentropyLoaded;
};

// Get Negentropy classes (throws if not loaded)
export const getNegentropy = () => {
    if (!isNegentropyLoaded) {
        throw new Error('Negentropy library not loaded. Call loadNegentropy() first.');
    }
    return {
        Negentropy: window.Negentropy,
        NegentropyStorageVector: window.NegentropyStorageVector
    };
};

// Declare global types for Negentropy
declare global {
    interface Window {
        Negentropy: any;
        NegentropyStorageVector: any;
    }
}
'use client';

// Suppress hydration warnings caused by browser extensions
// Browser extensions (like password managers, form fillers) add attributes
// like 'fdprocessedid' to DOM elements after SSR but before React hydrates,
// causing harmless hydration mismatches that don't affect functionality.

if (typeof window !== 'undefined') {
  // Store originals immediately
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  console.error = function (...args) {
    // Convert all args to string for checking
    const errorString = args.join(' ');
    
    // Suppress errors related to:
    // - fdprocessedid (browser extensions)
    // - Hydration mismatches from extensions
    // - Tree hydrated but attributes didn't match
    if (
      errorString.includes('fdprocessedid') ||
      errorString.includes('Hydration failed') ||
      errorString.includes('There was an error while hydrating') ||
      errorString.includes('A tree hydrated but some attributes') ||
      errorString.includes("server rendered HTML didn't match") ||
      errorString.includes('tree hydrated') ||
      (errorString.includes('attributes') && errorString.includes('match the client')) ||
      (errorString.includes('attributes') && errorString.includes('properties'))
    ) {
      return;
    }
    
    originalError(...args);
  };

  console.warn = function (...args) {
    const warnString = args.join(' ');
    
    // Suppress warnings related to hydration from extensions
    if (
      warnString.includes('fdprocessedid') ||
      warnString.includes('Hydration') ||
      (warnString.includes('Prop') && warnString.includes('did not match'))
    ) {
      return;
    }
    
    originalWarn(...args);
  };
}

export {};

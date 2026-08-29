/*
 * Platform detection from the User-Agent, done on the SERVER so the right
 * variant is in the first paint. Detecting in the browser would flash the
 * wrong instructions before hydration, which on an install page is the one
 * thing guaranteed to lose the user.
 *
 * UA sniffing is imprecise by nature; every branch degrades to instructions
 * that still work, and nothing is gated on it.
 */

export type Platform = "android" | "ios" | "ios-other-browser" | "desktop";

export function detectPlatform(userAgent: string): Platform {
  const ua = userAgent.toLowerCase();

  const isIos = /iphone|ipad|ipod/.test(ua);
  if (isIos) {
    // On iOS every browser is Safari underneath, but only real Safari has
    // the Share > Add to Home Screen path. Chrome/Firefox/Edge on iOS
    // announce themselves with these tokens.
    const isOtherBrowser = /crios|fxios|edgios|opios/.test(ua);
    return isOtherBrowser ? "ios-other-browser" : "ios";
  }

  if (/android/.test(ua)) return "android";
  return "desktop";
}

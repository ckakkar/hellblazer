/** Heart-rate rest on the Apple Watch: a tap once your heart rate's back down. On unless turned off. */
const HR_REST_KEY = "hell-blazer:hr-rest";

export function hrRestOn(): boolean {
  try {
    return window.localStorage.getItem(HR_REST_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHrRest(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(HR_REST_KEY);
    else window.localStorage.setItem(HR_REST_KEY, "off");
  } catch {
    // Storage blocked: it stays on.
  }
}

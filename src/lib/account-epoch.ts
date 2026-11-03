/**
 * Which signed-in stretch this page is in. Signing out (forgetThisDevice)
 * moves it on, so an answer that set off under one account and lands after
 * it left (a device link, a widget snapshot) can tell, and is dropped
 * instead of putting that account back on the phone.
 */
let epoch = 0;

export function accountEpoch(): number {
  return epoch;
}

/** The account is leaving this device: anything still on its way is stale. */
export function endAccountEpoch(): void {
  epoch++;
}

// Whether the attach sheet was closed without an answer (projects as realms).
// In memory only, so a closed sheet stays closed while the app runs, across
// tab switches, and asks again on the next launch.

let closed = false;

export const attachWasClosed = () => closed;

export function closeAttach(): void {
  closed = true;
}

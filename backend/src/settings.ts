let testMode = false; // Default is false

export function getTestMode(): boolean {
  return testMode;
}

export function setTestMode(value: boolean): void {
  testMode = value;
}
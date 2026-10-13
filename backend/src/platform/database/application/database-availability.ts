export abstract class DatabaseAvailability {
  abstract isReady(): Promise<boolean>;
}

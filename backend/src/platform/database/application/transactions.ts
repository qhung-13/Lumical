// Opaque application context: infrastructure adapters resolve it; no ORM type crosses this port.
export interface TransactionContext {
  readonly scope: symbol;
}

export abstract class Transactions {
  abstract run<T>(
    work: (context: TransactionContext) => Promise<T>,
  ): Promise<T>;
}

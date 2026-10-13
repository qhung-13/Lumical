import { Inject, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import {
  Transactions,
  type TransactionContext,
} from '../application/transactions';
import { Prisma, type PrismaClient } from './generated/client';
import { PrismaDatabase } from './prisma-database';

@Injectable()
export class PrismaTransactions extends Transactions {
  private readonly activeContext = new AsyncLocalStorage<TransactionContext>();
  private readonly clients = new WeakMap<
    TransactionContext,
    Prisma.TransactionClient
  >();

  constructor(
    @Inject(PrismaDatabase) private readonly database: PrismaDatabase,
  ) {
    super();
  }

  // Used only by infrastructure repository adapters. Completed/foreign contexts are rejected.
  clientFor(context: TransactionContext): Prisma.TransactionClient {
    const client = this.clients.get(context);
    if (!client)
      throw new Error('Transaction context is not active in this adapter.');
    return client;
  }

  async run<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    const active = this.activeContext.getStore();
    if (active) {
      // Join this async chain's transaction. An inherited, finished context
      // must fail instead of silently opening a new root transaction.
      this.clientFor(active);
      return work(active);
    }
    const client: PrismaClient = this.database.client;
    return client.$transaction(
      async (transaction) => {
        const context: TransactionContext = Object.freeze({
          scope: Symbol('database-transaction'),
        });
        this.clients.set(context, transaction);
        try {
          return await this.activeContext.run(context, () => work(context));
        } finally {
          this.clients.delete(context);
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }
}

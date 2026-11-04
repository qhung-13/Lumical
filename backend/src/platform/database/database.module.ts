import { Module } from '@nestjs/common';
import { DatabaseAvailability } from './application/database-availability';
import { Transactions } from './application/transactions';
import { PrismaDatabase } from './infrastructure/prisma-database';
import { PrismaTransactions } from './infrastructure/prisma-transactions';

@Module({
  providers: [
    PrismaDatabase,
    PrismaTransactions,
    { provide: DatabaseAvailability, useExisting: PrismaDatabase },
    { provide: Transactions, useExisting: PrismaTransactions },
  ],
  // PrismaDatabase is exported only for feature-owned infrastructure adapters;
  // generated models/clients remain private to infrastructure code.
  exports: [DatabaseAvailability, Transactions, PrismaDatabase],
})
export class DatabaseModule {}

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
  // Export ports only; generated models/clients remain infrastructure-owned.
  exports: [DatabaseAvailability, Transactions],
})
export class DatabaseModule {}

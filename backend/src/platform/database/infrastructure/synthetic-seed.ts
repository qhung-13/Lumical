import { PrismaDatabase } from './prisma-database';

export const syntheticIds = {
  owners: [
    '01000000-0000-4000-8000-000000000001',
    '01000000-0000-4000-8000-000000000002',
  ],
  template: '01000000-0000-4000-8000-000000000010',
  revision: '01000000-0000-4000-8000-000000000011',
} as const;

// Development seed only: disabled accounts, deliberately invalid password hash,
// inactive bilingual catalog. No provider, media, AR, payment or access facts.
export async function seedSynthetic(database: PrismaDatabase): Promise<void> {
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  await database.client.$transaction(async (tx) => {
    const users = syntheticIds.owners.map((id, index) => ({
      id,
      normalizedEmail: `synthetic-owner-${index + 1}@example.invalid`,
      passwordHash: 'SYNTHETIC_DISABLED_NO_USABLE_PASSWORD',
      status: 'DISABLED' as const,
      role: 'USER' as const,
      createdAt,
      updatedAt: createdAt,
    }));
    await tx.user.createMany({ data: users, skipDuplicates: true });
    for (const expected of users) {
      const found = await tx.user.findUniqueOrThrow({
        where: { id: expected.id },
      });
      if (
        found.normalizedEmail !== expected.normalizedEmail ||
        found.passwordHash !== expected.passwordHash ||
        found.status !== expected.status ||
        found.role !== expected.role
      ) {
        throw new Error(
          'Synthetic seed identity collision; no existing account was overwritten.',
        );
      }
    }
    await tx.template.createMany({
      data: [
        {
          id: syntheticIds.template,
          category: 'IMAGE',
          availability: 'INACTIVE',
          createdAt,
          updatedAt: createdAt,
        },
      ],
      skipDuplicates: true,
    });
    await tx.templateRevision.createMany({
      data: [
        {
          id: syntheticIds.revision,
          templateId: syntheticIds.template,
          revision: 1,
          nameVi: 'Lịch mẫu tổng hợp',
          nameEn: 'Synthetic calendar',
          descriptionVi: 'Dữ liệu tổng hợp dành cho phát triển.',
          descriptionEn: 'Synthetic development data.',
          layoutDefinition: { version: 1, monthCount: 12, imageSlotsPerMonth: 4 },
          stylePresets: [{ id: 'classic', nameVi: 'Cổ điển', nameEn: 'Classic' }],
          unitPriceMinor: 1450n,
          currency: 'USD',
          publishedAt: createdAt,
          createdAt,
        },
      ],
      skipDuplicates: true,
    });
    const revision = await tx.templateRevision.findUniqueOrThrow({
      where: { id: syntheticIds.revision },
    });
    const template = await tx.template.findUniqueOrThrow({
      where: { id: syntheticIds.template },
    });
    if (
      revision.templateId !== syntheticIds.template ||
      revision.unitPriceMinor !== 1450n ||
      revision.nameEn !== 'Synthetic calendar' ||
      revision.nameVi !== 'Lịch mẫu tổng hợp' ||
      template.availability !== 'INACTIVE' ||
      template.category !== 'IMAGE' ||
      template.currentPublishedRevisionId !== null
    ) {
      throw new Error(
        'Synthetic seed catalog collision; immutable content was not overwritten.',
      );
    }
  });
}

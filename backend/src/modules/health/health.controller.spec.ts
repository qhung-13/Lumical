import { Test } from '@nestjs/testing';
import { HealthModule } from './health.module';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports the technical service health without internal details', async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    try {
      expect(module.get(HealthController).getHealth()).toEqual({
        status: 'ok',
        service: 'lumical-backend',
      });
    } finally {
      await module.close();
    }
  });
});

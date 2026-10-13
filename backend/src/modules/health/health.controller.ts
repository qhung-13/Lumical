import {
  Controller,
  Get,
  Header,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseAvailability } from '../../platform/database/application/database-availability';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseAvailability)
    private readonly database: DatabaseAvailability,
  ) {}

  @Get('live')
  @Header('Cache-Control', 'no-store')
  getLive(): { alive: true } {
    return { alive: true };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  async getReady(): Promise<{ ready: true }> {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException({ ready: false });
    }
    return { ready: true };
  }

  // Preserve the I00 frontend health proof as a process-liveness compatibility route.
  @Get()
  @Header('Cache-Control', 'no-store')
  getHealth(): { status: 'ok'; service: 'lumical-backend' } {
    return { status: 'ok', service: 'lumical-backend' };
  }
}

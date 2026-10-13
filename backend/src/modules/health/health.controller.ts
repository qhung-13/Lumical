import {
  Controller,
  Get,
  Header,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseAvailability } from '../../platform/database/application/database-availability';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('health')
@ApiTags('health')
export class HealthController {
  constructor(
    @Inject(DatabaseAvailability)
    private readonly database: DatabaseAvailability,
  ) {}

  @Get('live')
  @ApiOperation({ operationId: 'getLiveness' })
  @ApiResponse({ status: 200, schema: { type: 'object', additionalProperties: false, required: ['alive'], properties: { alive: { type: 'boolean', enum: [true] } } } })
  @Header('Cache-Control', 'no-store')
  getLive(): { alive: true } {
    return { alive: true };
  }

  @Get('ready')
  @ApiOperation({ operationId: 'getReadiness' })
  @ApiResponse({ status: 200, schema: { type: 'object', additionalProperties: false, required: ['ready'], properties: { ready: { type: 'boolean', enum: [true] } } } })
  @ApiResponse({ status: 503, schema: { type: 'object', additionalProperties: false, required: ['ready'], properties: { ready: { type: 'boolean', enum: [false] } } } })
  @Header('Cache-Control', 'no-store')
  async getReady(): Promise<{ ready: true }> {
    if (!(await this.database.isReady())) {
      throw new ServiceUnavailableException({ ready: false });
    }
    return { ready: true };
  }

  // Preserve the I00 frontend health proof as a process-liveness compatibility route.
  @Get()
  @ApiOperation({ operationId: 'getFoundationHealth' })
  @ApiResponse({ status: 200, schema: { type: 'object', additionalProperties: false, required: ['status', 'service'], properties: { status: { type: 'string', enum: ['ok'] }, service: { type: 'string', enum: ['lumical-backend'] } } } })
  @Header('Cache-Control', 'no-store')
  getHealth(): { status: 'ok'; service: 'lumical-backend' } {
    return { status: 'ok', service: 'lumical-backend' };
  }
}

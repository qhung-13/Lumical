import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function openApiDocument(app: INestApplication) {
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('LumiCal API').setVersion('1.0.0')
    .addCookieAuth('__Host-lumical_session').build());
  for (const name of ['CredentialsDto', 'AccountStatusChangeDto']) {
    const schema = document.components?.schemas?.[name];
    if (schema && !('$ref' in schema)) schema.additionalProperties = false;
  }
  return document;
}

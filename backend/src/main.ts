import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './config/configure-app';
import { IdentityPolicy } from './modules/identity/application/ports';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.get(IdentityPolicy).assertConfigured();
  app.enableShutdownHooks();
  configureApp(app);

  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  await app.listen(port, app.get(IdentityPolicy).secure ? '0.0.0.0' : '127.0.0.1');
}
void bootstrap();

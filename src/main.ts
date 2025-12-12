import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import * as fs from 'fs';
import { configDotenv } from 'dotenv';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configDotenv();

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  const tempDir = process.env.TEMP_DIR || './temp';

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 PDF Utility Backend running on port: ${process.env.PORT}`);
}
bootstrap();

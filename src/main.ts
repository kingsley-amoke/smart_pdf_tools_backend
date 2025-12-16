import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import * as fs from 'fs';
import { configDotenv } from 'dotenv';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  configDotenv();

  // Enable CORS
  app.enableCors({
    origin: '*', // You can restrict this later
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Increase payload size for large files
  app.use(json({ limit: '100mb' }));
  app.use(urlencoded({ extended: true, limit: '100mb' }));

  const tempDir = process.env.TEMP_DIR || './temp';

  // Ensure temp directory exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
 // Use PORT from environment (required for Render)
  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Application running on: http://0.0.0.0:${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const typeOrmConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: config.get('DB_HOST', 'localhost'),
  port: config.get<number>('DB_PORT', 3306),
  username: config.get('DB_USERNAME', 'root'),
  password: config.get('DB_PASSWORD', ''),
  database: config.get('DB_NAME', 'plusone'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
  logging: config.get('NODE_ENV') === 'development',
});

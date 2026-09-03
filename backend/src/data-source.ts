import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './config/database.config';

// The Nest runtime loads .env via @nestjs/config; the standalone CLI does not.
dotenv.config();

export default new DataSource(buildDataSourceOptions());

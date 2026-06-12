import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis();

export const transactionQueue = new Queue('transactions', {
  connection,
});
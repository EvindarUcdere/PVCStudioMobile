import { SQLiteBindParams, SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../client';
import { SqliteCashTransactionRepository } from './SqliteCashTransactionRepository';
import { SqliteCustomerRepository } from './SqliteCustomerRepository';
import { SqliteDesignRepository } from './SqliteDesignRepository';
import { SqliteJobRepository } from './SqliteJobRepository';
import { SqlitePaymentRepository } from './SqlitePaymentRepository';
import { SqliteQuoteRepository } from './SqliteQuoteRepository';
import { SqliteStockRepository } from './SqliteStockRepository';
import { SqliteTemplateRepository } from './SqliteTemplateRepository';

function createDatabaseAdapter(database: SQLiteDatabase) {
  return {
    execAsync(sql: string) {
      return database.execAsync(sql);
    },
    runAsync(sql: string, params: unknown[] = []) {
      return database.runAsync(sql, params as SQLiteBindParams);
    },
    getFirstAsync<T>(sql: string, params: unknown[] = []) {
      return database.getFirstAsync<T>(sql, params as SQLiteBindParams);
    },
    getAllAsync<T>(sql: string, params: unknown[] = []) {
      return database.getAllAsync<T>(sql, params as SQLiteBindParams);
    },
  };
}

export async function createDesignRepository() {
  return new SqliteDesignRepository(createDatabaseAdapter(await getDatabase()));
}

export async function createCashTransactionRepository() {
  return new SqliteCashTransactionRepository(createDatabaseAdapter(await getDatabase()));
}

export async function createJobRepository() {
  return new SqliteJobRepository(createDatabaseAdapter(await getDatabase()));
}

export async function createStockRepository() {
  return new SqliteStockRepository(createDatabaseAdapter(await getDatabase()));
}

export async function createCustomerRepository() {
  return new SqliteCustomerRepository(createDatabaseAdapter(await getDatabase()));
}

export async function createTemplateRepository() {
  return new SqliteTemplateRepository(createDatabaseAdapter(await getDatabase()));
}

export async function createQuoteRepository() {
  return new SqliteQuoteRepository(createDatabaseAdapter(await getDatabase()));
}

export async function createPaymentRepository() {
  return new SqlitePaymentRepository(createDatabaseAdapter(await getDatabase()));
}

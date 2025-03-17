// src/models/credentials.ts
import { runQuery, all } from '../db';

export interface Credential {
  id?: number;
  api_key: string;
  api_secret: string;
  trade_amount: number;
  leverage: number;
}

export async function saveCredential(credential: Credential): Promise<number> {
  const { lastID } = await runQuery(
    `INSERT INTO credentials (api_key, api_secret, trade_amount, leverage) VALUES (?, ?, ?, ?)`,
    [credential.api_key, credential.api_secret, credential.trade_amount, credential.leverage]
  );
  return lastID;
}

export async function getCredentials(): Promise<Credential[]> {
  return await all(`SELECT * FROM credentials`) as Credential[];
}

export async function updateCredential(credential: Credential): Promise<void> {
  if (!credential.id) {
    throw new Error("ID is required to update a credential");
  }
  await runQuery(
    `UPDATE credentials 
     SET api_key = ?, 
         api_secret = ?, 
         trade_amount = ?, 
         leverage = ?, 
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [credential.api_key, credential.api_secret, credential.trade_amount, credential.leverage, credential.id]
  );
}

export async function deleteCredential(id: number): Promise<void> {
  await runQuery(`DELETE FROM credentials WHERE id = ?`, [id]);
}
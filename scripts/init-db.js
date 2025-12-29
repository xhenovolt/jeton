#!/usr/bin/env node

/**
 * Database initialization script
 * Creates necessary tables for authentication and audit logging
 * Run with: node scripts/init-db.js
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

const { Pool } = pg;

async function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('🚀 Initializing database tables...\n');
    const client = await pool.connect();

    try {
      // Create users table
      console.log('📝 Creating users table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'FOUNDER',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT valid_email CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
          CONSTRAINT valid_role CHECK (role IN ('FOUNDER', 'STAFF', 'VIEWER'))
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
      `);
      console.log('✅ Users table created\n');

      // Create audit_logs table
      console.log('📝 Creating audit_logs table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          entity TEXT NOT NULL,
          entity_id TEXT,
          metadata JSONB,
          ip_address TEXT,
          user_agent TEXT,
          status TEXT DEFAULT 'SUCCESS',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT valid_action CHECK (action IN (
            'LOGIN_SUCCESS',
            'LOGIN_FAILURE',
            'LOGOUT',
            'REGISTER',
            'TOKEN_VALIDATION_FAILURE',
            'PROTECTED_ROUTE_ACCESS',
            'ROUTE_DENIED',
            'USER_CREATED',
            'USER_UPDATED',
            'USER_DELETED',
            'ROLE_CHANGED',
            'ASSET_CREATE',
            'ASSET_CREATE_DENIED',
            'ASSET_UPDATE',
            'ASSET_UPDATE_DENIED',
            'ASSET_DELETE',
            'ASSET_DELETE_DENIED',
            'LIABILITY_CREATE',
            'LIABILITY_CREATE_DENIED',
            'LIABILITY_UPDATE',
            'LIABILITY_UPDATE_DENIED',
            'LIABILITY_DELETE',
            'LIABILITY_DELETE_DENIED',
            'DEAL_CREATE',
            'DEAL_CREATE_DENIED',
            'DEAL_UPDATE',
            'DEAL_UPDATE_DENIED',
            'DEAL_DELETE',
            'DEAL_DELETE_DENIED',
            'DEAL_STAGE_CHANGE',
            'DEAL_STAGE_CHANGE_DENIED'
          )),
          CONSTRAINT valid_status CHECK (status IN ('SUCCESS', 'FAILURE'))
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      `);
      console.log('✅ Audit logs table created\n');

      // Create assets table
      console.log('📝 Creating assets table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS assets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          acquisition_source TEXT,
          acquisition_date DATE,
          acquisition_cost NUMERIC(14,2),
          current_value NUMERIC(14,2) NOT NULL,
          depreciation_rate NUMERIC(5,2) DEFAULT 0,
          notes TEXT,
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT positive_values CHECK (acquisition_cost >= 0 AND current_value >= 0),
          CONSTRAINT valid_depreciation CHECK (depreciation_rate >= 0 AND depreciation_rate <= 100)
        );

        CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
        CREATE INDEX IF NOT EXISTS idx_assets_created_by ON assets(created_by);
        CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
      `);
      console.log('✅ Assets table created\n');

      // Create liabilities table
      console.log('📝 Creating liabilities table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS liabilities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          creditor TEXT,
          principal_amount NUMERIC(14,2) NOT NULL,
          outstanding_amount NUMERIC(14,2) NOT NULL,
          interest_rate NUMERIC(5,2) DEFAULT 0,
          due_date DATE,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          notes TEXT,
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT positive_amounts CHECK (principal_amount >= 0 AND outstanding_amount >= 0),
          CONSTRAINT valid_interest CHECK (interest_rate >= 0 AND interest_rate <= 100),
          CONSTRAINT valid_status CHECK (status IN ('ACTIVE', 'CLEARED', 'DEFAULTED', 'DEFERRED'))
        );

        CREATE INDEX IF NOT EXISTS idx_liabilities_category ON liabilities(category);
        CREATE INDEX IF NOT EXISTS idx_liabilities_status ON liabilities(status);
        CREATE INDEX IF NOT EXISTS idx_liabilities_created_by ON liabilities(created_by);
        CREATE INDEX IF NOT EXISTS idx_liabilities_created_at ON liabilities(created_at);
        CREATE INDEX IF NOT EXISTS idx_liabilities_due_date ON liabilities(due_date);
      `);
      console.log('✅ Liabilities table created\n');

      // Create deals table
      console.log('📝 Creating deals table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS deals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          client_name TEXT,
          value_estimate NUMERIC(14,2) DEFAULT 0,
          stage TEXT NOT NULL DEFAULT 'Lead',
          probability INTEGER DEFAULT 50,
          expected_close_date DATE,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          notes TEXT,
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT positive_value CHECK (value_estimate >= 0),
          CONSTRAINT valid_probability CHECK (probability >= 0 AND probability <= 100),
          CONSTRAINT valid_stage CHECK (stage IN ('Lead', 'Contacted', 'Proposal Sent', 'Negotiation', 'Won', 'Lost')),
          CONSTRAINT valid_deal_status CHECK (status IN ('ACTIVE', 'CLOSED', 'ARCHIVED'))
        );

        CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
        CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
        CREATE INDEX IF NOT EXISTS idx_deals_created_by ON deals(created_by);
        CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at);
        CREATE INDEX IF NOT EXISTS idx_deals_expected_close_date ON deals(expected_close_date);
      `);
      console.log('✅ Deals table created\n');

      console.log('✨ Database initialization complete!');
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initializeDatabase();

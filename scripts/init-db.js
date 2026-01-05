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
          full_name TEXT,
          role TEXT NOT NULL DEFAULT 'FOUNDER',
          status TEXT NOT NULL DEFAULT 'active',
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT valid_email CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
          CONSTRAINT valid_role CHECK (role IN ('FOUNDER', 'FINANCE', 'SALES', 'VIEWER')),
          CONSTRAINT valid_status CHECK (status IN ('active', 'suspended'))
        );

        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
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
            'STAFF_CREATED',
            'STAFF_SUSPENDED',
            'STAFF_REACTIVATED',
            'ASSET_CREATE',
            'ASSET_CREATE_DENIED',
            'ASSET_UPDATE',
            'ASSET_UPDATE_DENIED',
            'ASSET_DELETE',
            'ASSET_DELETE_DENIED',
            'ASSET_RESTORE',
            'ASSET_LOCK',
            'ASSET_UNLOCK',
            'LIABILITY_CREATE',
            'LIABILITY_CREATE_DENIED',
            'LIABILITY_UPDATE',
            'LIABILITY_UPDATE_DENIED',
            'LIABILITY_DELETE',
            'LIABILITY_DELETE_DENIED',
            'LIABILITY_RESTORE',
            'LIABILITY_LOCK',
            'LIABILITY_UNLOCK',
            'DEAL_CREATE',
            'DEAL_CREATE_DENIED',
            'DEAL_UPDATE',
            'DEAL_UPDATE_DENIED',
            'DEAL_DELETE',
            'DEAL_DELETE_DENIED',
            'DEAL_RESTORE',
            'DEAL_LOCK',
            'DEAL_UNLOCK',
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

      // Create sessions table
      console.log('📝 Creating sessions table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
        CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at);
      `);
      console.log('✅ Sessions table created\n');

      // Create staff_profiles table
      console.log('📝 Creating staff_profiles table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS staff_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          department TEXT,
          title TEXT,
          phone TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON staff_profiles(user_id);
        CREATE INDEX IF NOT EXISTS idx_staff_profiles_department ON staff_profiles(department);
      `);
      console.log('✅ Staff profiles table created\n');

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
          locked BOOLEAN DEFAULT false,
          deleted_at TIMESTAMP WITH TIME ZONE,
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT positive_values CHECK (acquisition_cost >= 0 AND current_value >= 0),
          CONSTRAINT valid_depreciation CHECK (depreciation_rate >= 0 AND depreciation_rate <= 100)
        );

        CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
        CREATE INDEX IF NOT EXISTS idx_assets_created_by ON assets(created_by);
        CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
        CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_assets_locked ON assets(locked);
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
          locked BOOLEAN DEFAULT false,
          deleted_at TIMESTAMP WITH TIME ZONE,
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
        CREATE INDEX IF NOT EXISTS idx_liabilities_deleted_at ON liabilities(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_liabilities_locked ON liabilities(locked);
      `);
      console.log('✅ Liabilities table created\n');

      // Create deals table
      console.log('📝 Creating deals table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS deals (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          value_estimate NUMERIC(14,2) DEFAULT 0,
          stage TEXT NOT NULL DEFAULT 'Lead',
          probability INTEGER DEFAULT 50,
          assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
          expected_close_date DATE,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          locked BOOLEAN DEFAULT false,
          deleted_at TIMESTAMP WITH TIME ZONE,
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
        CREATE INDEX IF NOT EXISTS idx_deals_deleted_at ON deals(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_deals_locked ON deals(locked);
      `);
      console.log('✅ Deals table created\n');

      // Create snapshots table
      console.log('📝 Creating snapshots table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS snapshots (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type TEXT NOT NULL,
          name TEXT,
          data JSONB NOT NULL,
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT valid_snapshot_type CHECK (type IN ('NET_WORTH', 'PIPELINE_VALUE', 'FINANCIAL_SUMMARY', 'MANUAL'))
        );

        CREATE INDEX IF NOT EXISTS idx_snapshots_type ON snapshots(type);
        CREATE INDEX IF NOT EXISTS idx_snapshots_created_by ON snapshots(created_by);
        CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at);
      `);
      console.log('✅ Snapshots table created\n');

      // ======================================================================
      // NEW DOMAIN TABLES
      // ======================================================================

      // Create assets (accounting - tangible, depreciable)
      console.log('📝 Creating assets (accounting) table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS assets_accounting (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          asset_type TEXT NOT NULL,
          asset_subtype TEXT,
          acquisition_cost NUMERIC(15,2) NOT NULL,
          acquisition_date DATE NOT NULL,
          depreciation_method TEXT NOT NULL DEFAULT 'straight_line',
          depreciation_rate NUMERIC(5,2) NOT NULL,
          accumulated_depreciation NUMERIC(15,2) NOT NULL DEFAULT 0,
          current_book_value NUMERIC(15,2) GENERATED ALWAYS AS (acquisition_cost - accumulated_depreciation) STORED,
          residual_value NUMERIC(15,2),
          location TEXT,
          owner_name TEXT,
          status TEXT DEFAULT 'active',
          disposal_date DATE,
          disposal_value NUMERIC(15,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          CONSTRAINT asset_type_check CHECK (asset_type IN ('laptop', 'phone', 'equipment', 'furniture', 'other')),
          CONSTRAINT positive_costs CHECK (acquisition_cost >= 0),
          CONSTRAINT depreciation_range CHECK (depreciation_rate >= 0 AND depreciation_rate <= 100)
        );

        CREATE INDEX IF NOT EXISTS idx_assets_accounting_type ON assets_accounting(asset_type);
        CREATE INDEX IF NOT EXISTS idx_assets_accounting_status ON assets_accounting(status);
        CREATE INDEX IF NOT EXISTS idx_assets_accounting_created_at ON assets_accounting(created_at);
      `);
      console.log('✅ Accounting assets table created\n');

      // Create asset depreciation log
      console.log('📝 Creating asset depreciation logs table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_depreciation_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          asset_id UUID NOT NULL REFERENCES assets_accounting(id) ON DELETE RESTRICT,
          period_start DATE NOT NULL,
          period_end DATE NOT NULL,
          depreciation_amount NUMERIC(15,2) NOT NULL,
          calculation_method TEXT,
          useful_life_years INTEGER,
          units_produced INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          notes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_depreciation_asset ON asset_depreciation_logs(asset_id);
        CREATE INDEX IF NOT EXISTS idx_depreciation_period ON asset_depreciation_logs(period_start, period_end);
      `);
      console.log('✅ Asset depreciation logs table created\n');

      // Create intellectual property table
      console.log('📝 Creating intellectual property table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS intellectual_property (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          ip_type TEXT NOT NULL,
          ip_subtype TEXT,
          development_cost NUMERIC(15,2) NOT NULL,
          development_start_date DATE,
          development_completion_date DATE,
          valuation_estimate NUMERIC(15,2),
          valuation_basis TEXT,
          revenue_generated_lifetime NUMERIC(15,2) DEFAULT 0,
          revenue_generated_monthly NUMERIC(15,2) DEFAULT 0,
          clients_count INTEGER DEFAULT 0,
          monetization_model TEXT,
          ownership_percentage NUMERIC(5,2) DEFAULT 100,
          owner_name TEXT,
          status TEXT DEFAULT 'active',
          launch_date DATE,
          sunset_date DATE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          CONSTRAINT ip_type_check CHECK (ip_type IN ('software', 'internal_system', 'licensed_ip', 'brand', 'other')),
          CONSTRAINT positive_values CHECK (development_cost >= 0 AND revenue_generated_lifetime >= 0),
          CONSTRAINT ownership_range CHECK (ownership_percentage >= 0 AND ownership_percentage <= 100)
        );

        CREATE INDEX IF NOT EXISTS idx_ip_type ON intellectual_property(ip_type);
        CREATE INDEX IF NOT EXISTS idx_ip_status ON intellectual_property(status);
        CREATE INDEX IF NOT EXISTS idx_ip_created_at ON intellectual_property(created_at);
      `);
      console.log('✅ Intellectual property table created\n');

      // Create IP valuation log
      console.log('📝 Creating IP valuation logs table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS ip_valuation_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ip_id UUID NOT NULL REFERENCES intellectual_property(id) ON DELETE RESTRICT,
          previous_valuation NUMERIC(15,2),
          new_valuation NUMERIC(15,2) NOT NULL,
          valuation_basis TEXT,
          reason TEXT,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_valuation_ip ON ip_valuation_logs(ip_id);
        CREATE INDEX IF NOT EXISTS idx_valuation_created_at ON ip_valuation_logs(created_at);
      `);
      console.log('✅ IP valuation logs table created\n');

      // Create infrastructure table
      console.log('📝 Creating infrastructure table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS infrastructure (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          infrastructure_type TEXT NOT NULL,
          owner_name TEXT,
          access_level TEXT,
          risk_level TEXT,
          replacement_cost NUMERIC(15,2),
          domain_name VARCHAR(255),
          domain_registrar VARCHAR(100),
          domain_expiry_date DATE,
          domain_auto_renew BOOLEAN DEFAULT TRUE,
          platform TEXT,
          social_handle VARCHAR(255),
          social_recovery_email VARCHAR(255),
          social_recovery_phone VARCHAR(20),
          file_location VARCHAR(500),
          version VARCHAR(50),
          status TEXT DEFAULT 'active',
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          CONSTRAINT infra_type_check CHECK (infrastructure_type IN ('brand', 'website', 'domain', 'social_media', 'design_system', 'other')),
          CONSTRAINT positive_replacement_cost CHECK (replacement_cost IS NULL OR replacement_cost >= 0)
        );

        CREATE INDEX IF NOT EXISTS idx_infra_type ON infrastructure(infrastructure_type);
        CREATE INDEX IF NOT EXISTS idx_infra_risk ON infrastructure(risk_level);
        CREATE INDEX IF NOT EXISTS idx_infra_status ON infrastructure(status);
      `);
      console.log('✅ Infrastructure table created\n');

      // Create infrastructure audit log
      console.log('📝 Creating infrastructure audit logs table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS infrastructure_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          infrastructure_id UUID NOT NULL REFERENCES infrastructure(id) ON DELETE RESTRICT,
          event_type TEXT,
          previous_value TEXT,
          new_value TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          notes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_infra_audit_infrastructure ON infrastructure_audit_logs(infrastructure_id);
        CREATE INDEX IF NOT EXISTS idx_infra_audit_created_at ON infrastructure_audit_logs(created_at);
      `);
      console.log('✅ Infrastructure audit logs table created\n');

      // Create valuation summary table
      console.log('📝 Creating valuation summary table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS valuation_summary (
          id SERIAL PRIMARY KEY,
          total_assets_book_value NUMERIC(15,2),
          total_depreciation_period NUMERIC(15,2),
          total_ip_valuation NUMERIC(15,2),
          total_infrastructure_value NUMERIC(15,2),
          accounting_net_worth NUMERIC(15,2),
          strategic_company_value NUMERIC(15,2),
          calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT only_one_row CHECK (id = 1)
        );

        INSERT INTO valuation_summary (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
      `);
      console.log('✅ Valuation summary table created\n');

      // Create shares tables
      console.log('📝 Creating shares table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS shares (
          id SERIAL PRIMARY KEY,
          authorized_shares BIGINT NOT NULL DEFAULT 100,
          company_valuation DECIMAL(19, 2) DEFAULT 0.00,
          class_type VARCHAR(50) DEFAULT 'common',
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Only insert if table is empty
      const shareCheck = await client.query('SELECT COUNT(*) FROM shares');
      if (shareCheck.rows[0].count === 0) {
        await client.query(`
          INSERT INTO shares (authorized_shares, company_valuation, class_type, status)
          VALUES (100, 0.00, 'common', 'active')
        `);
      }
      
      console.log('✅ Shares table created with flexible authorized shares model\n');

      // Create share allocations table
      console.log('📝 Creating share_allocations table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS share_allocations (
          id SERIAL PRIMARY KEY,
          owner_id INTEGER NOT NULL,
          owner_name VARCHAR(255) NOT NULL,
          owner_email VARCHAR(255),
          shares_allocated BIGINT NOT NULL,
          allocation_date DATE DEFAULT CURRENT_DATE,
          vesting_start_date DATE,
          vesting_end_date DATE,
          vesting_percentage DECIMAL(5, 2) DEFAULT 100.00,
          notes TEXT,
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      try {
        await client.query(`
          CREATE INDEX idx_share_allocations_owner ON share_allocations(owner_id)
        `);
      } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }

      try {
        await client.query(`
          CREATE INDEX idx_share_allocations_status ON share_allocations(status)
        `);
      } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }

      try {
        await client.query(`
          CREATE OR REPLACE FUNCTION update_share_allocations_timestamp()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql
        `);
      } catch (e) {
        // Function might already exist, that's ok
      }

      try {
        await client.query(`
          DROP TRIGGER IF EXISTS share_allocations_update_timestamp ON share_allocations
        `);
      } catch (e) {
        // Trigger might not exist, that's ok
      }

      try {
        await client.query(`
          CREATE TRIGGER share_allocations_update_timestamp
          BEFORE UPDATE ON share_allocations
          FOR EACH ROW
          EXECUTE PROCEDURE update_share_allocations_timestamp()
        `);
      } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }

      console.log('✅ Share allocations table created\n');

      // Create share price history table
      console.log('📝 Creating share_price_history table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS share_price_history (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL UNIQUE,
          opening_price DECIMAL(19, 4),
          closing_price DECIMAL(19, 4) NOT NULL,
          high_price DECIMAL(19, 4),
          low_price DECIMAL(19, 4),
          company_valuation DECIMAL(19, 2),
          total_shares BIGINT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      try {
        await client.query(`
          CREATE INDEX idx_share_price_date ON share_price_history(date)
        `);
      } catch (e) {
        if (!e.message.includes('already exists')) throw e;
      }
      console.log('✅ Share price history table created\n');

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

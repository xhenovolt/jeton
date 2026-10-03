-- 985_marzpay_ledger_link.sql
--
-- Make MarzPay money land in the canonical books instead of a parallel one.
--
-- WHY
--
-- 984 gave marzpay_transactions a ledger_entry_id, but nothing said WHICH
-- internal account a given MarzPay wallet corresponds to. Without that link
-- there is no defensible way to post a collection into `ledger`, so MarzPay
-- balances would have sat beside the company accounts as a second source of
-- truth -- exactly the split this codebase already suffers from elsewhere.
--
-- Each MarzPay account now points at one row in `accounts`. A completed
-- collection is then posted to that account in `ledger` like any other
-- money-in, so it flows through /finance/ledger, /reports and
-- /financial-intelligence with no special-casing: those read `ledger`, and
-- MarzPay income is now simply part of it.
--
-- NOT DOUBLE COUNTED
--
-- marzpay_transactions.ledger_entry_id is set in the same transaction as the
-- ledger insert and is checked first, so reconciling twice is a no-op. The
-- partial unique index below makes that a database guarantee rather than a
-- convention: one ledger entry can back at most one MarzPay transaction.
--
-- SAFETY
--
-- Additive and idempotent. Creates one nullable column, one index, and an
-- internal account for the existing MarzPay wallet only if none is mapped.

ALTER TABLE marzpay_accounts
  ADD COLUMN IF NOT EXISTS ledger_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN marzpay_accounts.ledger_account_id IS
  'The internal accounts row this MarzPay wallet maps to. Completed collections are posted here in `ledger`, so MarzPay income appears in the normal finance reports.';

-- A ledger entry may back at most one MarzPay transaction. This is what makes
-- repeated reconciliation safe at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS uq_marzpay_tx_ledger_entry
  ON marzpay_transactions (ledger_entry_id) WHERE ledger_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marzpay_accounts_ledger
  ON marzpay_accounts (ledger_account_id);

-- Give the existing wallet an internal account to post into. `accounts` has no
-- balance column in this schema -- balances are derived from `ledger` -- so
-- this only needs identity, not an opening figure.
INSERT INTO accounts (name, type, currency, description, is_active)
SELECT 'MarzPay Wallet', 'other', 'UGX',
       'Mobile-money wallet held at MarzPay. Collections reconcile into this account.',
       TRUE
 WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE name = 'MarzPay Wallet');

UPDATE marzpay_accounts ma
   SET ledger_account_id = a.id, updated_at = NOW()
  FROM accounts a
 WHERE a.name = 'MarzPay Wallet'
   AND ma.ledger_account_id IS NULL;

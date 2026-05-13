-- D1 Database Schema for AI Lead Generator v2.1

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  api_key TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  daily_lead_count INTEGER DEFAULT 0,
  daily_message_count INTEGER DEFAULT 0,
  total_lead_count INTEGER DEFAULT 0,
  usage_date TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  industry TEXT,
  location TEXT,
  contact_channel TEXT,
  contact_info TEXT,
  lead_score INTEGER DEFAULT 50,
  buying_intent_reason TEXT,
  outreach_strategy TEXT,
  outreach_email TEXT,
  outreach_instagram TEXT,
  outreach_linkedin TEXT,
  best_channel TEXT,
  lead_category TEXT DEFAULT 'warm',
  region_competition_score INTEGER DEFAULT 50,
  source TEXT DEFAULT 'ai_generated',
  status TEXT DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(lead_category);



## Auto-fill Broker MC# via FMCSA API

### Overview
Store the FMCSA API key securely, add an `mc_number` field to the broker scores table, create a backend function to look up brokers by name via the FMCSA public API, and display the MC# in the load detail next to the broker name/RTS score.

### Steps

1. **Store FMCSA API key** as a secret using the secrets tool

2. **Database migration** — Add `mc_number` column to `broker_credit_scores`:
```sql
ALTER TABLE broker_credit_scores ADD COLUMN mc_number text;
```

3. **New backend function** `lookup-broker-mc/index.ts`:
   - Receives `broker_name` as input
   - Calls FMCSA API: `https://mobile.fmcsa.dot.gov/qc/services/carriers/name/${encodedName}?webKey=KEY`
   - Extracts the MC number from the response
   - Returns `{ mc_number, dot_number, legal_name }`

4. **Update `useBrokerScores.ts`**:
   - Add `mc_number` to the `BrokerCreditScore` interface
   - Add a `lookupMc` mutation that calls the edge function and updates the broker record
   - Auto-trigger lookup when saving a new broker score if `mc_number` is missing

5. **Update `LoadDetailPanel.tsx` `BrokerScoreRow`**:
   - Display `MC# XXXXXX` badge next to the RTS score when available
   - Show a small "lookup" spinner while fetching from FMCSA
   - Add a refresh button to re-fetch MC# on demand

### Files to create/modify
- Secret: `FMCSA_API_KEY`
- Migration: add `mc_number` column
- New: `supabase/functions/lookup-broker-mc/index.ts`
- Edit: `src/hooks/useBrokerScores.ts`
- Edit: `src/components/LoadDetailPanel.tsx`


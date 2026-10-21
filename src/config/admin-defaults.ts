// Account lifecycle stages, grouped by the account status they imply.
// `AccountStatus` / `AccountStage` (src/types/account.ts) are derived from this.

export const DEFAULT_STAGES = {
  "Prospect": ['Discovery', 'Demo', 'Scoping', 'Proposal', 'Paused', 'Closed Lost'],
  'Customer': ['Onboarding', 'Live Customer', 'Cancelled Contract'],
  'Hidden': ['Soft Delete']
};

// Mirrors the backend handlers/labels.go. Keep in sync.

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  INTERNAL_AUDIT: 'Internal Audit & Training',
  REMOTE_NAV_AUDIT: 'Remote Navigation Audit',
  INCIDENT_INVESTIGATION: 'Incident Investigation',
  PRE_PURCHASE_INSPECTION: 'Pre-Purchase Inspection',
  SHIP_RECYCLING_AUDIT: 'Ship Recycling Audit',
};

export const PROJECT_TYPES = Object.keys(PROJECT_TYPE_LABELS);

export const STAGE_LABELS: Record<string, string> = {
  ENQUIRY: 'Enquiry',
  CONFIRMED: 'Confirmed',
  DATA_COLLECTION: 'Data Collection',
  ANALYSIS: 'Analysis',
  REPORT_DRAFT: 'Report Draft',
  REPORT_SUBMITTED: 'Report Submitted',
  AWAITING_FEEDBACK: 'Awaiting Feedback',
  COMPLETED: 'Completed',
};

export const STAGES = Object.keys(STAGE_LABELS);

// Used by stage badges. Plain colour names — keep contrast strong; the
// senior-user UX bar prohibits washed-out greys.
export const STAGE_BADGE: Record<string, string> = {
  ENQUIRY: 'bg-navy-100 text-navy-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  DATA_COLLECTION: 'bg-amber-100 text-amber-800',
  ANALYSIS: 'bg-orange-100 text-orange-800',
  REPORT_DRAFT: 'bg-violet-100 text-violet-800',
  REPORT_SUBMITTED: 'bg-teal-100 text-teal-800',
  AWAITING_FEEDBACK: 'bg-pink-100 text-pink-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

export const FILE_CATEGORY_LABELS: Record<string, string> = {
  RAW_DATA: 'Raw Data',
  DRAFT_REPORT: 'Draft Report',
  FINAL_REPORT: 'Final Report',
  FEEDBACK: 'Feedback',
  OTHER: 'Other',
};

export const FILE_CATEGORIES = Object.keys(FILE_CATEGORY_LABELS);

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  STAFF: 'Staff',
  CLIENT_ADMIN: 'Client Admin',
  CLIENT_VIEWER: 'Client Viewer',
};

export const ROLES = Object.keys(ROLE_LABELS);

export function isClientRole(role: string): boolean {
  return role === 'CLIENT_ADMIN' || role === 'CLIENT_VIEWER';
}

export function isNivyashRole(role: string): boolean {
  return role === 'ADMIN' || role === 'STAFF';
}

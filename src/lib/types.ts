export type CaseStatus = "Active" | "Pending" | "Closed" | "Disposed";
export type Priority = "High" | "Medium" | "Low";

// Single source of truth for the Case Type and Case Stage dropdowns —
// used by the New/Edit Case form and the Cases list filter.
export const CASE_TYPES: string[] = [
  "Civil Suit",
  "Criminal Case",
  "Criminal Complaint",
  "Bail",
  "Family Case",
  "Constitutional Petition",
  "Civil Appeal",
  "Criminal Appeal",
  "Civil Revision",
  "Criminal Revision",
  "Review",
  "Execution",
  "Rent Case",
  "Commercial Case",
  "Banking / Recovery",
  "Labour Case",
  "Service Matter",
  "Consumer Case",
  "Company / Corporate Matter",
  "Customs / Tax Matter",
  "Narcotics Case",
  "Anti-Terrorism Case",
  "Accountability Case",
  "Cybercrime Case",
  "Environmental Case",
  "Intellectual Property Case",
  "Arbitration",
  "Contempt",
  "Guardianship / Custody",
  "Succession / Probate",
  "Writ / Constitutional Matter",
  "Matrimonial Matter",
  "Legal Notice",
  "Application / Miscellaneous",
  "Other",
];

export const CASE_STAGES: string[] = [
  "Pre-Filing",
  "Filed / Institution",
  "Notice / Summons",
  "Appearance",
  "Pleadings",
  "Preliminary / Interim Proceedings",
  "Issues / Points for Determination",
  "Evidence",
  "Cross-Examination",
  "Arguments",
  "Judgment / Order Reserved",
  "Judgment / Order Passed",
  "Decree / Final Order",
  "Appeal",
  "Revision",
  "Review",
  "Execution / Compliance",
  "Settlement / Compromise",
  "Withdrawn",
  "Dismissed",
  "Disposed",
  "Stayed",
  "Remanded",
  "Restoration",
  "Other",
];

// Shared role list used for the "Counsel For" field.
export const CASE_ROLES: string[] = [
  "Plaintiff",
  "Petitioner",
  "Applicant",
  "Appellant",
  "Revisionist",
  "Complainant",
  "Private Complainant",
  "Claimant",
  "Objector",
  "Intervenor / Intervener",
  "Aggrieved Person",
  "Victim / Aggrieved Person",
  "Decree Holder",
  "Auction Purchaser",
  "Bank / Financial Institution",
  "Taxpayer",
  "Guardian",
  "Third Party",
  "Convict / Appellant",
  "State",
  "Prosecution",
  "Other",
  "Defendant",
  "Respondent",
  "Respondent in Appeal",
  "Respondent in Revision",
  "Opposite Party",
  "Accused",
  "Federation",
  "Province",
  "Government Department",
  "Government Authority",
  "Regulatory Authority",
  "Creditor",
  "Borrower / Customer",
  "Department / Authority",
];

// Which side of the case a party is on. Multiple parties can share a side
// (e.g. two co-plaintiffs suing one defendant) — the form groups people
// under "Party 1" / "Party 2" by this, rather than by list position.
export type PartySide = 1 | 2;

export const RELATION_TYPES = ["Son of", "Wife of", "Daughter of"] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export interface Party {
  id: string;
  side: PartySide;
  name: string;
  role: string;
  phone?: string;
  cnic?: string;
  address?: string;
  relationType?: RelationType;
  relationName?: string;
}

export type TimelineEventType =
  | "filed"
  | "statement"
  | "issues"
  | "evidence"
  | "hearing"
  | "order"
  | "other";

export interface TimelineEvent {
  id: string;
  title: string;
  date: string; // ISO date
  description: string;
  type: TimelineEventType;
}

export interface Hearing {
  id: string;
  caseId: string;
  date: string; // ISO datetime
  purpose: string;
  court: string;
  counselFor?: string;
}

export interface Task {
  id: string;
  caseId?: string;
  title: string;
  dueDate?: string; // ISO date
  status: "Pending" | "Completed";
  priority?: Priority;
}

export interface LegalCase {
  id: string;
  caseNumber: string;
  title: string;
  court: string;
  filingDate: string; // ISO date
  caseType: string;
  counselFor: string;
  stage: string;
  status: CaseStatus;
  priority: Priority;
  lastUpdated: string; // ISO datetime
  parties: Party[];
  timeline: TimelineEvent[];
  notes?: string;
}

export interface CaseDocument {
  id: string;
  caseId: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string; // ISO datetime
  storedPath: string; // relative path within the uploads directory on disk
}

export interface Database {
  cases: LegalCase[];
  hearings: Hearing[];
  tasks: Task[];
  documents: CaseDocument[];
}

export interface DashboardStats {
  totalCases: number;
  activeCases: number;
  hearingsThisMonth: number;
  pendingTasks: number;
  overdueTasks: number;
}

// -------------------------------------------------------------- Major Acts --
export interface LawSection {
  number: string;
  title: string;
  page: number; // 1-indexed page number in the source PDF
  text: string;
}

export interface LawActMeta {
  slug: string;
  act: string;
  pdfFile: string;
  sectionCount: number;
  hasIndex: boolean;
}

export interface LawActDetail extends LawActMeta {
  sections: LawSection[];
}

// Contract types based on the smart contract overview
export interface PassportData {
  tokenId: string;
  owner: string;
  dataURI: string;
  dataHash: string;
  createdAt: number;
  updatedAt: number;
  status: PassportStatus;
  lastVerifier?: string;
  verificationURI?: string;
}

export enum PassportStatus {
  None = 0,
  Pending = 1,
  Verified = 2,
  Rejected = 3,
  Revoked = 4
}

export enum DemographicCategory {
  BirthYear = 0,
  Nationality = 1,
  VaccineStatus = 2,
  MedicationType = 3,
  AllergyType = 4,
  TreatmentType = 5
}

export interface UserData {
  encryptedName: string;
  encryptedBirthDate: string;
  encryptedNationality: string;
  encryptedVaccines: string;
  encryptedMedications: string;
  encryptedAllergies: string;
  encryptedTreatments: string;
}

export interface ZKProof {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
  inputs: bigint[];
}

export interface ProofRecord {
  proofId: string;
  submitter: string;
  category: DemographicCategory;
  value: bigint;
  proofHash: string;
  verified: boolean;
  submissionId?: string;
}

export interface GlobalMetrics {
  totalPassports: bigint;
  verifiedPassports: bigint;
  totalRevenue: bigint;
  lastUpdated: bigint;
}

export interface AnalyticsPackage {
  id: string;
  name: string;
  description: string;
  price: bigint;
  active: boolean;
  includedMetrics: bigint[];
}

export interface TreatmentCampaign {
  address: string;
  hub: string;
  token: string;
  beneficiary: string;
  payout: string;
  goal: bigint;
  deadline: number;
  totalPledged: bigint;
  state: CampaignState;
}

export enum CampaignState {
  Active = 0,
  Successful = 1,
  Failed = 2,
  Canceled = 3,
  Withdrawn = 4
}

export interface VerifierInfo {
  active: boolean;
  name: string;
  uri: string;
}

// Network configuration from config.ts
export interface NetworkConfig {
  label: string;
  rpcUrl: string;
  contracts: {
    accessManager: string;
    analytics: string;
    fundingHub: string;
    healthPassport: string;
    mockUsdt: string;
    treatmentImplementation: string;
    zkpVerifier: string;
  };
}
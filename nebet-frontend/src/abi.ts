import { parseAbi } from "viem";

export const ACCESS_MANAGER_ABI = parseAbi([
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error AccessControlBadConfirmation()",
  "function addVerifier(address account, string name, string uri)",
  "function removeVerifier(address account)",
  "function isVerifier(address account) view returns (bool)",
  "function verifierInfo(address account) view returns ((bool active, string name, string uri))",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function VERIFIER_ROLE() view returns (bytes32)"
]);

export const MOCK_ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount)",
  "function mint(address to, uint256 amount)"
]);

export const HEALTH_PASSPORT_ABI = parseAbi([
  "error NotOwner()",
  "error NotVerifier()",
  "error NotAdmin()",
  "error PaymentRequired()",
  "function PASSPORT_FEE() view returns (uint256)",
  "function mintPassport(string dataURI, bytes32 dataHash, (string,string,string,string,string,string,string) userData, (uint256[2],uint256[2][2],uint256[2],uint256[])[] demographicProofs, uint8[] categories, uint256[] values) returns (uint256)",
  "function upsert(uint256 tokenId, string dataURI, bytes32 dataHash)",
  "function submitForVerification(uint256 tokenId)",
  "function verify(uint256 tokenId, bool approved, string verificationURI)",
  "function revoke(uint256 tokenId, string reason)",
  "function isVerified(uint256 tokenId) view returns (bool)",
  "function passportOf(uint256 tokenId) view returns (address owner, string dataURI, bytes32 dataHash, uint256 createdAt, uint256 updatedAt, uint8 status, address lastVerifier, string verificationURI)",
  "function verificationRequests(uint256 tokenId) view returns (uint256 tokenId, uint8 method, uint256 requestTime, bool fulfilled, bytes proof)",
  "function getProofRecords(uint256 tokenId) view returns (uint256[] memory proofIds, uint8[] memory categories, uint256[] memory values, bool[] memory verified)",
  "function getUserData(uint256 tokenId) view returns ((string,string,string,string,string,string,string))",
  "function tokenURI(uint256 tokenId) view returns (string)"
]);

export const ANALYTICS_ABI = parseAbi([
  "function getGlobalMetrics() view returns (uint256 totalPassports, uint256 verifiedPassports, uint256 totalRevenue, uint256 lastUpdated)",
  "function setHealthPassport(address account)",
  "function recordVerifiedDemographic(uint8 category, uint256 value, uint256 amount)",
  "function getVerifiedDemographicCount(uint8 category, uint256 value) view returns (uint256)",
  "function getVerifiedDemographicBatch(uint8[] categories, uint256[] values) view returns (uint256[] memory)",
  "function createAnalyticsPackage(string name, string description, uint256 price, uint256[] includedMetrics) returns (uint256)",
  "function purchaseAnalytics(uint256 packageId)",
  "function withdrawFees(address recipient, uint256 amount)"
]);

export const FUNDING_HUB_ABI = parseAbi([
  "function accessManager() view returns (address)",
  "function passport() view returns (address)",
  "function campaignImplementation() view returns (address)",
  "function admin() view returns (address)",
  "function setAdmin(address newAdmin)",
  "function createCampaign(uint256 beneficiaryPassportId, address token, uint256 goal, uint64 deadline, address payout) returns (address)",
  "event CampaignCreated(address indexed campaign, address indexed beneficiary, address token, uint256 goal, uint64 deadline, address payout)"
]);

export const TREATMENT_CAMPAIGN_ABI = parseAbi([
  "function hub() view returns (address)",
  "function token() view returns (address)",
  "function beneficiary() view returns (address)",
  "function payout() view returns (address)",
  "function goal() view returns (uint256)",
  "function deadline() view returns (uint64)",
  "function totalPledged() view returns (uint256)",
  "function pledges(address account) view returns (uint256)",
  "function state() view returns (uint8)",
  "function pledge(uint256 amount)",
  "function unpledge(uint256 amount)",
  "function finalize()",
  "function withdraw()",
  "function claimRefund()"
]);

export const ZKP_VERIFIER_ABI = parseAbi([
  "function submitProof((uint256[2],uint256[2][2],uint256[2],uint256[]) proof, uint8 category, uint256 value) returns (uint256)",
  "function submitProofBatch((uint256[2],uint256[2][2],uint256[2],uint256[])[] proofs, uint8[] categories, uint256[] values) returns (uint256[] memory)",
  "function markVerified(uint256 proofId, bytes32 submissionId)",
  "function markVerifiedBatch(uint256[] proofIds, bytes32[] submissionIds)",
  "function isVerified(uint256 proofId) view returns (bool)",
  "function proofInfo(uint256 proofId) view returns (address submitter, uint8 category, uint256 value, bytes32 proofHash, bool verified, bytes32 submissionId)",
  "function getDemographicCount(uint8 category, uint256 value) view returns (uint256)",
  "event ProofSubmitted(uint256 indexed proofId, address indexed submitter, uint8 indexed category, uint256 value, bytes32 proofHash)",
  "event ProofVerified(uint256 indexed proofId, bytes32 submissionId)"
]);

import React, { useEffect, useMemo, useState } from 'react';
import { keccak256, type Address } from 'viem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Textarea } from '../ui/Input';
import { Stepper } from '../ui/Stepper';
import {
  ShieldCheckIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import { useWallet } from '../../wallet/WalletProvider';
import { CONTRACTS, NETWORK_LABEL } from '../../config';
import { useAnalyticsMetrics } from '../../hooks/useAnalyticsMetrics';
import { usePassports, PassportRecord, PassportStatus, EncryptedFieldKey } from '../../hooks/usePassports';
import { useToast } from '../ui/Toast';
import nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import { HEALTH_PASSPORT_ABI } from '../../abi';
import { publicClient } from '../../lib/viemClient';

const PASSPORT_FEE_USDT = 50;

const ENCRYPTED_FIELDS: Array<{ key: EncryptedFieldKey; label: string }> = [
  { key: 'encryptedName', label: 'Encrypted Name' },
  { key: 'encryptedBirthDate', label: 'Encrypted Birth Date' },
  { key: 'encryptedNationality', label: 'Encrypted Nationality' },
  { key: 'encryptedVaccines', label: 'Encrypted Vaccination History' },
  { key: 'encryptedMedications', label: 'Encrypted Medications' },
  { key: 'encryptedAllergies', label: 'Encrypted Allergies' },
  { key: 'encryptedTreatments', label: 'Encrypted Treatments' }
];

type PlainFieldKey = 'name' | 'birthDate' | 'nationality' | 'vaccines' | 'medications' | 'allergies' | 'treatments';

type PersonalFieldConfig = {
  plainKey: PlainFieldKey;
  encryptedKey: EncryptedFieldKey;
  label: string;
  placeholder: string;
  helper?: string;
  type?: 'input' | 'textarea';
};

type MintProof = {
  category: number;
  value: string;
  proofFile: File | null;
  json?: string;
  normalized?: NormalizedProof;
  isDemo?: boolean;
};

type MintFormState = {
  encryptedName: string;
  encryptedBirthDate: string;
  encryptedNationality: string;
  encryptedVaccines: string;
  encryptedMedications: string;
  encryptedAllergies: string;
  encryptedTreatments: string;
  proofs: MintProof[];
};

type NormalizedProof = {
  a: readonly [bigint, bigint];
  b: readonly [readonly [bigint, bigint], readonly [bigint, bigint]];
  c: readonly [bigint, bigint];
  inputs: readonly bigint[];
};

const PERSONAL_FIELDS: PersonalFieldConfig[] = [
  {
    plainKey: 'name',
    encryptedKey: 'encryptedName',
    label: 'Full Name',
    placeholder: 'e.g. Jane Doe'
  },
  {
    plainKey: 'birthDate',
    encryptedKey: 'encryptedBirthDate',
    label: 'Birth Date',
    placeholder: 'e.g. 1990-01-01'
  },
  {
    plainKey: 'nationality',
    encryptedKey: 'encryptedNationality',
    label: 'Nationality',
    placeholder: 'e.g. Canadian'
  },
  {
    plainKey: 'vaccines',
    encryptedKey: 'encryptedVaccines',
    label: 'Vaccination History',
    placeholder: 'List vaccinations...',
    type: 'textarea'
  },
  {
    plainKey: 'medications',
    encryptedKey: 'encryptedMedications',
    label: 'Current Medications',
    placeholder: 'List medications...',
    type: 'textarea'
  },
  {
    plainKey: 'allergies',
    encryptedKey: 'encryptedAllergies',
    label: 'Allergies',
    placeholder: 'List allergies...',
    type: 'textarea'
  },
  {
    plainKey: 'treatments',
    encryptedKey: 'encryptedTreatments',
    label: 'Ongoing Treatments',
    placeholder: 'List treatments...',
    type: 'textarea'
  }
];

const textEncoder = new TextEncoder();

function utf8ToHex(value: string): `0x${string}` {
  const bytes = textEncoder.encode(value);
  let hex = '0x';
  bytes.forEach((byte) => {
    hex += byte.toString(16).padStart(2, '0');
  });
  return hex as `0x${string}`;
}

function base64ToHex(value: string): `0x${string}` {
  const binary = window.atob(value);
  let hex = '0x';
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex as `0x${string}`;
}

function previewEncrypted(value?: string) {
  if (!value) return '—';
  if (value.length <= 16) return value;
  return `${value.slice(0, 12)}…${value.slice(-6)}`;
}

const mintSteps = [
  { id: '1', name: 'Personal Info', description: 'Encrypted health data' },
  { id: '2', name: 'Upload Proofs', description: 'ZK proofs for verification' },
  { id: '3', name: 'Payment', description: '50 USDT minting fee' },
  { id: '4', name: 'Mint Passport', description: 'Create NFT on-chain' }
];

const demographicCategories = [
  'Birth Year',
  'Nationality', 
  'Vaccine Status',
  'Medication Type',
  'Allergy Type',
  'Treatment Type'
];

function encryptWithPublicKey(publicKeyBase64: string, plaintext: string) {
  const publicKey = naclUtil.decodeBase64(publicKeyBase64);
  const ephemKeyPair = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = naclUtil.decodeUTF8(plaintext);
  const ciphertext = nacl.box(messageUint8, nonce, publicKey, ephemKeyPair.secretKey);

  return {
    version: 'x25519-xsalsa20-poly1305',
    nonce: naclUtil.encodeBase64(nonce),
    ephemPublicKey: naclUtil.encodeBase64(ephemKeyPair.publicKey),
    ciphertext: naclUtil.encodeBase64(ciphertext)
  };
}

const SAMPLE_PROOF_JSON = JSON.stringify(
  {
    a: [1, 2],
    b: [
      [3, 4],
      [5, 6]
    ],
    c: [7, 8],
    inputs: [12345]
  },
  null,
  2
);

const SAMPLE_PROOF_CATEGORY = 0;
const SAMPLE_PROOF_VALUE = '1990';

function normalizeProof(json: string): NormalizedProof {
  const parsed = JSON.parse(json);
  const toPair = (value: unknown): readonly [bigint, bigint] => {
    const arr = Array.isArray(value) ? value : [0, 0];
    return [BigInt(arr?.[0] ?? 0), BigInt(arr?.[1] ?? 0)] as const;
  };

  return {
    a: toPair(parsed.a),
    b: [toPair(parsed.b?.[0]), toPair(parsed.b?.[1])] as const,
    c: toPair(parsed.c),
    inputs: Array.isArray(parsed.inputs)
      ? parsed.inputs.map((value) => BigInt(value ?? 0))
      : []
  };
}

function createDemoProof(): MintProof {
  return {
    category: SAMPLE_PROOF_CATEGORY,
    value: SAMPLE_PROOF_VALUE,
    proofFile: null,
    json: SAMPLE_PROOF_JSON,
    normalized: normalizeProof(SAMPLE_PROOF_JSON),
    isDemo: true
  };
}

function shortenHash(hash: string) {
  if (hash.length <= 10) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export const Passports: React.FC = () => {
  const [showMintModal, setShowMintModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPassport, setSelectedPassport] = useState<PassportRecord | null>(null);
  const [mintStep, setMintStep] = useState(0);
  const [mintForm, setMintForm] = useState<MintFormState>({
    encryptedName: '',
    encryptedBirthDate: '',
    encryptedNationality: '',
    encryptedVaccines: '',
    encryptedMedications: '',
    encryptedAllergies: '',
    encryptedTreatments: '',
    proofs: []
  });

  const {
    isConnected,
    connect,
    isConnecting,
    isCorrectNetwork,
    switchToConfiguredNetwork,
    formattedUsdtBalance,
    account,
    walletClient,
    refreshBalances
  } = useWallet();

  const { metrics } = useAnalyticsMetrics();
  const totalPassportsMinted = Number(metrics.totalPassports);

  const accountForQuery: Address | undefined = isConnected && isCorrectNetwork && account ? account : undefined;

  const { passports, loading: loadingPassports, error: passportError, refresh: refreshPassports } = usePassports(
    accountForQuery,
    totalPassportsMinted
  );

  const [decryptedCache, setDecryptedCache] = useState<Record<string, Record<EncryptedFieldKey, string>>>({});
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [encryptingField, setEncryptingField] = useState<EncryptedFieldKey | null>(null);
  const [personalInfo, setPersonalInfo] = useState<Record<PlainFieldKey, string>>({
    name: '',
    birthDate: '',
    nationality: '',
    vaccines: '',
    medications: '',
    allergies: '',
    treatments: ''
  });
  const [minting, setMinting] = useState(false);

  const selectedDecrypted = useMemo(() => {
    if (!selectedPassport) return undefined;
    return decryptedCache[selectedPassport.tokenId.toString()];
  }, [decryptedCache, selectedPassport]);

  const canMint = isConnected && isCorrectNetwork;
  const { addToast } = useToast();

  useEffect(() => {
    if (!showMintModal) return;
    setMintForm((prev) => {
      if (prev.proofs.length > 0) return prev;
      return {
        ...prev,
        proofs: [createDemoProof()]
      };
    });
  }, [showMintModal]);

const getStatusBadge = (status: PassportStatus) => {
  switch (status) {
    case 'verified':
      return <Badge variant="success">Verified</Badge>;
    case 'pending':
      return <Badge variant="warning">Pending</Badge>;
    case 'rejected':
      return <Badge variant="error">Rejected</Badge>;
    case 'revoked':
      return <Badge variant="error">Revoked</Badge>;
    case 'none':
    default:
      return <Badge>Unknown</Badge>;
  }
};

const getStatusIcon = (status: PassportStatus) => {
  switch (status) {
    case 'verified':
      return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
    case 'pending':
      return <ClockIcon className="h-5 w-5 text-yellow-600" />;
    case 'rejected':
    case 'revoked':
      return <XCircleIcon className="h-5 w-5 text-red-600" />;
    default:
      return <ShieldCheckIcon className="h-5 w-5 text-gray-600" />;
  }
};

  const addProof = () => {
    setMintForm(prev => ({
      ...prev,
      proofs: [...prev.proofs, { category: 0, value: '', proofFile: null, json: '', normalized: undefined }]
    }));
  };

  const removeProof = (index: number) => {
    setMintForm(prev => ({
      ...prev,
      proofs: prev.proofs.filter((_, i) => i !== index)
    }));
  };

  const updateProof = <K extends keyof MintProof>(
    index: number,
    field: K,
    value: MintProof[K]
  ) => {
    setMintForm(prev => ({
      ...prev,
      proofs: prev.proofs.map((proof, i) => {
        if (i !== index) return proof;
        const next: MintProof = { ...proof, [field]: value };
        if (field !== 'normalized') {
          next.isDemo = false;
        }
        return next;
      })
    }));
  };

  const nextStep = () => {
    if (mintStep < mintSteps.length - 1) {
      setMintStep(mintStep + 1);
    }
  };

  const prevStep = () => {
    if (mintStep > 0) {
      setMintStep(mintStep - 1);
    }
  };

  const handleMint = async () => {
    if (!walletClient || !account) {
      addToast({ title: 'Wallet required', description: 'Connect a wallet before minting.', type: 'error' });
      return;
    }

    if (!isCorrectNetwork) {
      addToast({ title: 'Wrong network', description: `Switch to ${NETWORK_LABEL} to mint.`, type: 'warning' });
      return;
    }

    const missingEncrypted = PERSONAL_FIELDS.filter((field) => !mintForm[field.encryptedKey]);
    if (missingEncrypted.length > 0) {
      addToast({
        title: 'Encrypt personal info first',
        description: `Encrypt ${missingEncrypted.map((field) => field.label).join(', ')}`,
        type: 'error'
      });
      setMintStep(0);
      return;
    }

    const proofsWithJson = mintForm.proofs.filter((proof) => proof.json && proof.json.length > 0);
    const invalidProof = proofsWithJson.some((proof) => !proof.normalized);
    if (invalidProof) {
      addToast({
        title: 'Proofs incomplete',
        description: 'One or more proofs could not be parsed. Replace or remove them before minting.',
        type: 'error'
      });
      setMintStep(1);
      return;
    }

    const normalizedProofs = proofsWithJson.map((proof) => proof.normalized!);
    const demographicProofs = normalizedProofs.map((proof) => [
      [proof.a[0], proof.a[1]],
      [
        [proof.b[0][0], proof.b[0][1]],
        [proof.b[1][0], proof.b[1][1]]
      ],
      [proof.c[0], proof.c[1]],
      proof.inputs
    ] as const);

    let proofValues: bigint[] = [];
    try {
      proofValues = proofsWithJson.map((proof) => {
        const raw = proof.value?.trim();
        if (!raw) return 0n;
        return BigInt(raw);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proof values must be numeric.';
      addToast({ title: 'Invalid proof value', description: message, type: 'error' });
      setMintStep(1);
      return;
    }

    const metadata = {
      version: 1,
      issuedAt: new Date().toISOString(),
      description: 'Nebet health passport minted via dashboard',
      preview: {
        name: personalInfo.name || '—',
        nationality: personalInfo.nationality || '—'
      }
    };
    const metadataJson = JSON.stringify(metadata);
    const dataURI = `data:application/json;utf-8,${encodeURIComponent(metadataJson)}`;
    const dataHash = keccak256(utf8ToHex(metadataJson));

    const userData: [string, string, string, string, string, string, string] = [
      mintForm.encryptedName,
      mintForm.encryptedBirthDate,
      mintForm.encryptedNationality,
      mintForm.encryptedVaccines,
      mintForm.encryptedMedications,
      mintForm.encryptedAllergies,
      mintForm.encryptedTreatments
    ];

    setMinting(true);
    try {
      const hash = await walletClient.writeContract({
        account,
        address: CONTRACTS.healthPassport,
        abi: HEALTH_PASSPORT_ABI,
        functionName: 'mintPassport',
        args: [
          dataURI,
          dataHash,
          userData,
          demographicProofs,
          proofsWithJson.map((proof) => proof.category),
          proofValues
        ]
      });

      addToast({
        title: 'Mint transaction submitted',
        description: shortenHash(hash),
        type: 'info'
      });

      await publicClient.waitForTransactionReceipt({ hash });
      addToast({ title: 'Passport minted', description: 'Your passport has been created on-chain.', type: 'success' });
      closeMintModal();
      refreshPassports();
      await refreshBalances();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to mint passport.';
      addToast({ title: 'Mint failed', description: message, type: 'error' });
    } finally {
      setMinting(false);
    }
  };

  const closeMintModal = () => {
    setShowMintModal(false);
    setMintStep(0);
    setMintForm({
      encryptedName: '',
      encryptedBirthDate: '',
      encryptedNationality: '',
      encryptedVaccines: '',
      encryptedMedications: '',
      encryptedAllergies: '',
      encryptedTreatments: '',
      proofs: []
    });
    setPersonalInfo({
      name: '',
      birthDate: '',
      nationality: '',
      vaccines: '',
      medications: '',
      allergies: '',
      treatments: ''
    });
    setEncryptingField(null);
    setMinting(false);
  };

  const setEncryptedValue = (key: EncryptedFieldKey, value: string) => {
    setMintForm((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const encryptField = async (config: PersonalFieldConfig) => {
    const provider = window.ethereum;
    if (!account || !provider?.request) {
      addToast({
        title: 'Wallet required',
        description: 'Connect a compatible wallet before encrypting.',
        type: 'error'
      });
      return;
    }

    const plaintext = personalInfo[config.plainKey]?.trim();
    if (!plaintext) {
      addToast({
        title: 'Enter information first',
        description: `Add plaintext for ${config.label} before encrypting.`,
        type: 'warning'
      });
      return;
    }

    try {
      setEncryptingField(config.encryptedKey);
      const publicKey = (await provider.request({
        method: 'eth_getEncryptionPublicKey',
        params: [account]
      })) as string;
      const payload = encryptWithPublicKey(publicKey, plaintext);
      const encoded = `wallet://${utf8ToHex(JSON.stringify(payload))}`;
      setEncryptedValue(config.encryptedKey, encoded);
      addToast({ title: `${config.label} encrypted`, type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to encrypt with wallet';
      addToast({ title: 'Encryption failed', description: message, type: 'error' });
    } finally {
      setEncryptingField(null);
    }
  };

  const handleProofFile = async (index: number, file: File | null) => {
    if (!file) {
      setMintForm((prev) => {
        const proofs = [...prev.proofs];
        proofs[index] = { ...proofs[index], proofFile: null, json: '', normalized: undefined, isDemo: false };
        return { ...prev, proofs };
      });
      return;
    }

    try {
      const text = await file.text();
      const normalized = normalizeProof(text);
      setMintForm((prev) => {
        const proofs = [...prev.proofs];
        proofs[index] = { ...proofs[index], proofFile: file, json: text, normalized, isDemo: false };
        return { ...prev, proofs };
      });
      addToast({ title: 'Proof imported', description: file.name, type: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid proof JSON';
      addToast({ title: 'Unable to parse proof', description: message, type: 'error' });
    }
  };

  const decryptPassportData = async (passport: PassportRecord) => {
    if (!account) {
      setDecryptError('Connect a wallet to decrypt the data');
      return;
    }
    const provider = window.ethereum;
    if (!provider) {
      setDecryptError('No Ethereum provider detected');
      return;
    }

    setDecrypting(true);
    setDecryptError(null);
    try {
      const decrypted: Record<EncryptedFieldKey, string> = {
        encryptedName: '',
        encryptedBirthDate: '',
        encryptedNationality: '',
        encryptedVaccines: '',
        encryptedMedications: '',
        encryptedAllergies: '',
        encryptedTreatments: ''
      };

      for (const { key } of ENCRYPTED_FIELDS) {
        const value = passport.userData[key];
        if (!value) {
          decrypted[key] = '';
          continue;
        }

        if (!value.startsWith('wallet://')) {
          decrypted[key] = value;
          continue;
        }

        const raw = value.slice('wallet://'.length);
        let payloadHex: `0x${string}`;
        if (raw.startsWith('0x')) {
          payloadHex = raw as `0x${string}`;
        } else {
          try {
            payloadHex = base64ToHex(raw);
          } catch {
            payloadHex = utf8ToHex(raw);
          }
        }

        try {
          const plaintext = await provider.request({
            method: 'eth_decrypt',
            params: [payloadHex, account]
          });
          decrypted[key] = plaintext as string;
        } catch (error) {
          console.warn('Failed to decrypt field', key, error);
          decrypted[key] = '<decrypt failed>';
          setDecryptError('One or more fields could not be decrypted');
        }
      }

      setDecryptedCache((prev) => ({
        ...prev,
        [passport.tokenId.toString()]: decrypted
      }));
    } finally {
      setDecrypting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1E2E3F] font-heading">
            Health Passports
          </h1>
          <p className="text-[#8F969C] mt-2 font-body">
            Manage your encrypted health records and verification status
          </p>
          {isConnected && (
            <p className="text-xs text-[#8F969C] mt-1 font-body">
              Wallet balance: {formattedUsdtBalance} USDT
            </p>
          )}
        </div>
        <Button
          onClick={() => setShowMintModal(true)}
          variant="primary"
          pill
          disabled={!canMint}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Mint Passport
        </Button>
      </div>

      {/* Connection Notices */}
      {!isConnected && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>Connect MetaMask to manage your passports</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm text-[#8F969C] font-body">
              You need to connect a wallet on {NETWORK_LABEL} to view and mint passports.
            </p>
            <Button onClick={connect} variant="primary" pill disabled={isConnecting}>
              <ShieldCheckIcon className="h-4 w-4 mr-2" />
              {isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </Button>
          </CardContent>
        </Card>
      )}

      {isConnected && !isCorrectNetwork && (
        <Card variant="bordered" className="border-yellow-300 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-700">Wrong Network</CardTitle>
            <CardDescription className="text-yellow-700">
              Please switch to {NETWORK_LABEL} to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={switchToConfiguredNetwork} variant="ghost" pill>
              Switch Network
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Passports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loadingPassports && (
          <Card variant="elevated" className="animate-pulse">
            <CardContent className="h-40" />
          </Card>
        )}

        {!loadingPassports && passports.map((passport) => {
          const created = passport.createdAt.toLocaleDateString();
          const updated = passport.updatedAt.toLocaleDateString();
          const shortVerifier = passport.lastVerifier
            ? `${passport.lastVerifier.slice(0, 6)}...${passport.lastVerifier.slice(-4)}`
            : null;

          return (
            <Card key={passport.tokenId.toString()} variant="elevated" className="hover:shadow-xl transition-shadow">
              {passport.metadata?.image && (
                <div className="relative h-40 rounded-t-xl overflow-hidden">
                  <img
                    src={passport.metadata.image}
                    alt={passport.metadata?.name ?? `Passport #${passport.tokenId.toString()}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(passport.status)}
                  <div>
                    <CardTitle className="text-lg">Passport #{passport.tokenId.toString()}</CardTitle>
                    <CardDescription>Created {created}</CardDescription>
                  </div>
                </div>
                {getStatusBadge(passport.status)}
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#8F969C] font-body">Last Updated:</span>
                  <span className="text-[#1E2E3F] font-body">{updated}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-[#8F969C] font-body">Proofs:</span>
                  <span className="text-[#1E2E3F] font-body">{passport.proofs.length}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-[#8F969C] font-body">Minting Fee:</span>
                  <span className="text-[#1E2E3F] font-body">{PASSPORT_FEE_USDT.toFixed(2)} USDT</span>
                </div>

                {shortVerifier && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#8F969C] font-body">Last Verifier:</span>
                    <span className="text-[#1E2E3F] font-mono text-xs">{shortVerifier}</span>
                  </div>
                )}

                {passport.verificationURI && (
                  <div className="text-sm">
                    <span className="text-[#8F969C] font-body">Verification URI:</span>
                    <a
                      href={passport.verificationURI}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#275365] ml-1 underline"
                    >
                      View
                    </a>
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSelectedPassport(passport);
                    setShowDetailsModal(true);
                  }}
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {passportError && (
        <Card variant="bordered" className="border-red-200 bg-red-50">
          <CardContent>
            <p className="text-sm text-red-600 font-body">{passportError.message}</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={refreshPassports}>
              Retry Fetch
            </Button>
          </CardContent>
        </Card>
      )}

      {!loadingPassports && passports.length === 0 && isConnected && isCorrectNetwork && (
        <Card variant="bordered" className="text-center py-12">
          <CardContent>
            <ShieldCheckIcon className="h-12 w-12 text-[#8F969C] mx-auto mb-4" />
            <CardTitle className="mb-2">No Passports Found</CardTitle>
            <CardDescription className="mb-6">
              Mint your first health passport to begin tracking verified medical records.
            </CardDescription>
            <Button onClick={() => setShowMintModal(true)} variant="primary" disabled={!canMint}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Mint Passport
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mint Passport Modal */}
      <Modal 
        isOpen={showMintModal} 
        onClose={closeMintModal}
        title="Mint Health Passport"
        size="lg"
      >
        <div className="space-y-6">
          <Stepper steps={mintSteps} currentStep={mintStep} />
          
          {/* Step 1: Personal Info */}
          {mintStep === 0 && (
            <div className="space-y-6">
              {PERSONAL_FIELDS.map((field) => {
                const encryptedValue = mintForm[field.encryptedKey];
                const isTextarea = field.type === 'textarea';
                const PlainComponent = isTextarea ? Textarea : Input;
                const EncryptedComponent = isTextarea ? Textarea : Input;

                return (
                  <div key={field.encryptedKey} className="space-y-3 border border-[#8F969C]/20 rounded-lg p-4 bg-white">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="sm:flex-1 sm:pr-4">
                        <PlainComponent
                          label={`${field.label} (Plaintext)`}
                          placeholder={field.placeholder}
                          value={personalInfo[field.plainKey]}
                          onChange={(e) =>
                            setPersonalInfo((prev) => ({ ...prev, [field.plainKey]: e.target.value }))
                          }
                          helper="This data stays local until you encrypt with your wallet."
                        />
                      </div>
                      <div className="flex sm:flex-col gap-2 sm:w-48">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => encryptField(field)}
                          loading={encryptingField === field.encryptedKey}
                        >
                          <LockClosedIcon className="h-4 w-4 mr-2" />
                          Encrypt
                        </Button>
                        <Button
                          variant="ghost"
                          className="flex-1"
                          onClick={() => {
                            setEncryptedValue(field.encryptedKey, '');
                            setPersonalInfo((prev) => ({ ...prev, [field.plainKey]: '' }));
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    <EncryptedComponent
                      label={`${field.label} (Encrypted)`}
                      value={encryptedValue}
                      readOnly
                      placeholder="Encrypted value will appear here"
                      helper="Encrypted using eth_getEncryptionPublicKey and encoded for on-chain storage."
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Step 2: Upload Proofs */}
          {mintStep === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-[#F2F5F7] border border-[#275365]/10 rounded-lg text-sm text-[#1E2E3F] font-body">
                A demo zero-knowledge proof is attached automatically so you can mint right away.
                You can import your own proof JSON files to replace or add to the list.
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-[#1E2E3F] font-heading">
                  Zero-Knowledge Proofs
                </h3>
                <Button variant="outline" size="sm" onClick={addProof}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Proof
                </Button>
              </div>
              
              {mintForm.proofs.map((proof, index) => (
                <div key={index} className="p-4 border border-[#8F969C]/20 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-[#1E2E3F] font-body">Proof #{index + 1}</h4>
                    <div className="flex items-center gap-2">
                      {proof.isDemo && <Badge variant="info">Demo</Badge>}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeProof(index)}
                      >
                        <XCircleIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-[#1E2E3F] font-body mb-1">
                        Category
                      </label>
                      <select
                        className="w-full px-3 py-2 border border-[#8F969C]/30 rounded-lg font-body"
                        value={proof.category}
                        onChange={(e) => {
                          const nextValue = Number.parseInt(e.target.value, 10);
                          updateProof(index, 'category', Number.isNaN(nextValue) ? 0 : nextValue);
                        }}
                      >
                        {demographicCategories.map((category, i) => (
                          <option key={i} value={i}>{category}</option>
                        ))}
                      </select>
                    </div>
                    
                    <Input
                      label="Value"
                      placeholder="Proof value"
                      value={proof.value}
                      onChange={(e) => updateProof(index, 'value', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-[#1E2E3F] font-body mb-1">
                      Proof File
                    </label>
                    <input
                      type="file"
                      accept=".json"
                      className="w-full px-3 py-2 border border-[#8F969C]/30 rounded-lg font-body"
                      onChange={(e) => handleProofFile(index, e.target.files?.[0] ?? null)}
                    />
                    {proof.json && (
                      <Textarea
                        className="mt-3"
                        label="Proof JSON"
                        value={proof.json}
                        readOnly
                        helper="Parsed locally and kept client-side."
                      />
                    )}
                    {proof.normalized && (
                      <div className="mt-3 text-xs text-[#8F969C] font-body space-y-1">
                        <p>Inputs: {proof.normalized.inputs.length > 0 ? proof.normalized.inputs.map((input) => input.toString()).join(', ') : '—'}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {mintForm.proofs.length === 0 && (
                <div className="text-center py-8 text-[#8F969C] font-body">
                  No proofs added yet. Click "Add Proof" to begin.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Payment */}
          {mintStep === 2 && (
            <div className="space-y-4">
              <div className="text-center p-6 bg-[#F2F5F7] rounded-lg">
                <CurrencyDollarIcon className="h-12 w-12 text-[#275365] mx-auto mb-4" />
                <h3 className="text-lg font-medium text-[#1E2E3F] font-heading mb-2">
                  Minting Fee Required
                </h3>
                <p className="text-[#8F969C] font-body mb-4">
                  A fee of 50 USDT is required to mint your health passport NFT.
                </p>
                <div className="text-2xl font-bold text-[#1E2E3F] font-heading">
                  {PASSPORT_FEE_USDT.toFixed(2)} USDT
                </div>
              </div>
              
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 font-body">
                  <strong>Note:</strong> Make sure you have approved the HealthPassport contract 
                  to spend 50 USDT from your wallet before proceeding.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Mint */}
          {mintStep === 3 && (
            <div className="space-y-4">
              <div className="text-center p-6">
                <ShieldCheckIcon className="h-16 w-16 text-[#275365] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#1E2E3F] font-heading mb-2">
                  Ready to Mint
                </h3>
                <p className="text-[#8F969C] font-body mb-6">
                  Your health passport is ready to be created on the blockchain.
                </p>
                
                {/* Summary */}
                <div className="text-left bg-[#F2F5F7] rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#8F969C] font-body">Proofs:</span>
                    <span className="text-[#1E2E3F] font-body">{mintForm.proofs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8F969C] font-body">Fee:</span>
                    <span className="text-[#1E2E3F] font-body">{PASSPORT_FEE_USDT.toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8F969C] font-body">Network:</span>
                    <span className="text-[#1E2E3F] font-body">{NETWORK_LABEL}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex justify-between pt-4">
            <Button 
              variant="outline" 
              onClick={prevStep}
              disabled={mintStep === 0 || minting}
            >
              Previous
            </Button>
            
            {mintStep < mintSteps.length - 1 ? (
              <Button variant="primary" onClick={nextStep} disabled={minting}>
                Next
              </Button>
            ) : (
              <Button variant="primary" onClick={handleMint} loading={minting} disabled={minting}>
                Mint Passport
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Passport Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={selectedPassport ? `Passport #${selectedPassport.tokenId.toString()} Details` : 'Passport Details'}
        size="lg"
      >
        {selectedPassport && (
          <div className="space-y-6">
            {selectedPassport.metadata?.image && (
              <div className="rounded-xl overflow-hidden">
                <img
                  src={selectedPassport.metadata.image}
                  alt={selectedPassport.metadata?.name ?? 'Passport image'}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Status</h4>
                <div className="mt-1">{getStatusBadge(selectedPassport.status)}</div>
              </div>
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Token ID</h4>
                <p className="text-[#8F969C] font-body mt-1">#{selectedPassport.tokenId.toString()}</p>
              </div>
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Created</h4>
                <p className="text-[#8F969C] font-body mt-1">{selectedPassport.createdAt.toLocaleString()}</p>
              </div>
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Last Updated</h4>
                <p className="text-[#8F969C] font-body mt-1">{selectedPassport.updatedAt.toLocaleString()}</p>
              </div>
            </div>

            {selectedPassport.lastVerifier && (
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Last Verifier</h4>
                <p className="text-[#8F969C] font-mono text-sm mt-1">{selectedPassport.lastVerifier}</p>
              </div>
            )}

            {selectedPassport.verificationURI && (
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Verification URI</h4>
                <a
                  href={selectedPassport.verificationURI}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#275365] underline text-sm font-body mt-1 inline-block"
                >
                  View Verification Details
                </a>
              </div>
            )}

            {selectedPassport.metadata?.raw && (
              <div>
                <h4 className="font-medium text-[#1E2E3F] font-body">Metadata</h4>
                <pre className="bg-[#F2F5F7] rounded-lg p-4 text-xs text-[#1E2E3F] overflow-x-auto">
                  {JSON.stringify(selectedPassport.metadata.raw, null, 2)}
                </pre>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-[#1E2E3F] font-body">Encrypted Data</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => decryptPassportData(selectedPassport)}
                  disabled={decrypting}
                >
                  {decrypting ? 'Decrypting…' : 'Decrypt with Wallet'}
                </Button>
              </div>
              {decryptError && (
                <p className="text-xs text-red-500 font-body">{decryptError}</p>
              )}
              <div className="space-y-2">
                {ENCRYPTED_FIELDS.map(({ key, label }) => (
                  <div key={key} className="p-3 bg-[#F2F5F7] rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-body text-[#1E2E3F]">{label}</p>
                        <p className="text-xs text-[#8F969C] font-mono break-all">{previewEncrypted(selectedPassport.userData[key])}</p>
                      </div>
                      {selectedDecrypted?.[key] && (
                        <Badge variant="success" size="sm">Decrypted</Badge>
                      )}
                    </div>
                    {selectedDecrypted?.[key] && (
                      <div className="mt-2 text-sm text-[#1E2E3F] font-body whitespace-pre-wrap break-words">
                        {selectedDecrypted[key]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-[#1E2E3F] font-body mb-3">Proof Records</h4>
              <div className="space-y-2">
                {selectedPassport.proofs.length === 0 && (
                  <div className="p-4 bg-[#F2F5F7] rounded-lg text-sm text-[#8F969C]">
                    No proof records stored for this passport.
                  </div>
                )}
                {selectedPassport.proofs.map((proof) => (
                  <div key={proof.proofId.toString()} className="flex items-center justify-between p-3 bg-[#F2F5F7] rounded-lg">
                    <div className="flex items-center space-x-3">
                      <DocumentTextIcon className="h-4 w-4 text-[#275365]" />
                      <div>
                        <p className="text-sm font-body text-[#1E2E3F]">
                          {demographicCategories[proof.category] ?? `Category ${proof.category}`}
                        </p>
                        <p className="text-xs text-[#8F969C] font-mono">
                          Value: {proof.value.toString()} • Proof #{proof.proofId.toString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={proof.verified ? "success" : "warning"} size="sm">
                      {proof.verified ? "Verified" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" className="flex-1" disabled>
                Submit for Verification
              </Button>
              <Button variant="primary" className="flex-1" disabled>
                Update Data
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

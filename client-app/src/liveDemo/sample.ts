// KS_CLIENT_v11_LIVE_DEMO - the sample file the live demo's client app shows. It mirrors KS-server's
// src/demo/fixture.ts (the same fictional business, borrower, documents and lenders), so the broker side of the demo
// tells the same story. Everything here is fictional; phone numbers use the 555-01xx range set aside for fiction.
import type { ApplicationData } from "../types/application";

/** The one application the demo works on. A fixed UUID so every screen, test and the broker side agree. */
export const DEMO_APPLICATION_ID = "5a3c1d2e-7b4f-4c6a-9e8d-2f1b0c9a8e71";

export const SAMPLE_BUSINESS = {
  legalName: "Juniper Hollow Millwork Ltd.",
  operatingName: "Juniper Hollow Millwork",
  industry: "Manufacturing",
  naics: "337110",
  started: "2019-04-01",
  employees: 18,
  street: "123 Example Street",
  city: "Edmonton",
  province: "AB",
  postal: "T5J 0A1",
  phone: "(780) 555-0100",
  website: "juniperhollow.example",
  annualRevenue: 2_140_000,
};

export const SAMPLE_CONTACT = {
  firstName: "Sam",
  lastName: "Carter",
  title: "Owner and President",
  email: "sam@juniperhollow.example",
  phone: "(780) 555-0142",
  dob: "1981-05-14",
  // A clearly fake identity number: the field accepts it and nobody can mistake it for a real SIN.
  sin: "000-000-000",
  street: "45 Sample Crescent",
  city: "Edmonton",
  province: "AB",
  postal: "T6X 0A1",
  ownership: "100",
};

export const SAMPLE_REQUEST = {
  amount: 250_000,
  termMonths: 60,
  equipmentCost: 268_000,
  downPayment: 18_000,
  purpose: "A new 5x10 CNC router and dust collection, to bring cabinet-door work in-house.",
};

/** The broker the client sees as their advisor (fictional). */
export const SAMPLE_ADVISOR = { id: "demo-advisor", firstName: "Alex", lastName: "Morgan" };

/** The six documents of the sample file (same keys as KS-server SAMPLE_DOCS). */
export const SAMPLE_DOCS = [
  { key: "bank_2026_07", label: "Bank statement - July 2026", category: "bank_statement", filename: "Bank-Statement-2026-07-SAMPLE.pdf" },
  { key: "bank_2026_08", label: "Bank statement - August 2026", category: "bank_statement", filename: "Bank-Statement-2026-08-SAMPLE.pdf" },
  { key: "bank_2026_09", label: "Bank statement - September 2026", category: "bank_statement", filename: "Bank-Statement-2026-09-SAMPLE.pdf" },
  { key: "financials_2025", label: "Financial statements - FY2025", category: "accountant_financials", filename: "Financials-FY2025-SAMPLE.pdf" },
  { key: "void_cheque", label: "Void cheque", category: "void_cheque", filename: "Void-Cheque-SAMPLE.pdf" },
  { key: "photo_id", label: "Photo ID (placeholder)", category: "photo_id", filename: "Photo-ID-PLACEHOLDER-SAMPLE.pdf" },
] as const;

/** What the lender panel asks for on an equipment file (Step 5's list). */
export const SAMPLE_REQUIRED_DOCS = [
  { id: "req:bank", document_type: "3 months business bank statements", required: true, stage: 1 },
  { id: "req:financials", document_type: "Accountant prepared financial statements", required: true, stage: 1 },
  { id: "req:void", document_type: "Void cheque", required: true, stage: 1 },
  { id: "req:id", document_type: "Government issued photo ID", required: true, stage: 1 },
];

type DemoLender = { id: string; name: string; product: string; category: string; min: number; max: number; rate: string; term: string };

/** The fictional lenders (KS-server DEMO_LENDERS), as the client app's product catalogue. */
export const SAMPLE_LENDERS: DemoLender[] = [
  { id: "aspen-ridge", name: "Aspen Ridge Capital", product: "Equipment finance", category: "EQUIPMENT", min: 50_000, max: 1_500_000, rate: "7.9% - 11.5%", term: "24 - 72 months" },
  { id: "northgate", name: "Northgate Equipment Finance", product: "Equipment lease", category: "EQUIPMENT", min: 25_000, max: 500_000, rate: "8.5% - 13.0%", term: "24 - 60 months" },
  { id: "granite-peak", name: "Granite Peak Credit Union", product: "Term and equipment loans", category: "EQUIPMENT", min: 50_000, max: 750_000, rate: "7.2% - 9.9%", term: "36 - 84 months" },
  { id: "silverline", name: "Silverline Commercial Lending", product: "Senior term loan", category: "TERM", min: 100_000, max: 5_000_000, rate: "6.9% - 9.5%", term: "36 - 120 months" },
  { id: "cobalt-bay", name: "Cobalt Bay Funding", product: "Revenue-based advance", category: "MCA", min: 10_000, max: 300_000, rate: "Factor 1.25 - 1.45", term: "6 - 18 months" },
  { id: "harbourline", name: "Harbourline Asset Finance", product: "Large-ticket equipment", category: "EQUIPMENT", min: 250_000, max: 10_000_000, rate: "6.5% - 8.9%", term: "36 - 96 months" },
];

export function sampleLenderProducts() {
  return SAMPLE_LENDERS.map((l) => ({
    id: `${l.id}-product`,
    name: l.product,
    category: l.category,
    product_type: l.category,
    country: "CA",
    amount_min: l.min,
    amount_max: l.max,
    rate: l.rate,
    term: l.term,
    lender_id: l.id,
    lender_name: l.name,
    status: "active",
    required_documents: SAMPLE_REQUIRED_DOCS.map((d) => ({ category: d.document_type, required: true })),
  }));
}

const money = (n: number) => "$" + n.toLocaleString("en-CA");

/**
 * The wizard answers, using the exact option strings each step's dropdowns offer, so every screen shows a filled-in
 * form the client only has to look at.
 */
export function samplePrefill(): Partial<ApplicationData> {
  const amount = money(SAMPLE_REQUEST.amount);
  return {
    kyc: {
      lookingFor: "EQUIPMENT",
      equipmentAmount: amount,
      fundingAmount: amount,
      requestedAmount: amount,
      businessLocation: "Canada",
      industry: SAMPLE_BUSINESS.industry,
      purposeOfFunds: "Buy New Equipment",
      monthlyRevenue: "$100,000 to $250,000",
      yearsInBusiness: "Over 3 Years",
      salesHistory: "Over 3 Years",
      annualRevenue: "$1,000,001 to $3,000,000",
      revenueLast12Months: "$1,000,001 to $3,000,000",
      arBalance: "$100,000 to $250,000",
      accountsReceivable: "$100,000 to $250,000",
      availableCollateral: "$250,001 to $500,000",
      fixedAssets: "$250,001 to $500,000",
      companyName: SAMPLE_BUSINESS.legalName,
      fullName: `${SAMPLE_CONTACT.firstName} ${SAMPLE_CONTACT.lastName}`,
      email: SAMPLE_CONTACT.email,
      phone: SAMPLE_CONTACT.phone,
    },
    productCategory: "EQUIPMENT_FINANCE",
    selectedProductType: "EQUIPMENT_FINANCE",
    business: {
      businessName: SAMPLE_BUSINESS.operatingName,
      companyName: SAMPLE_BUSINESS.operatingName,
      legalName: SAMPLE_BUSINESS.legalName,
      businessStructure: "Corporation",
      address: SAMPLE_BUSINESS.street,
      city: SAMPLE_BUSINESS.city,
      state: SAMPLE_BUSINESS.province,
      zip: SAMPLE_BUSINESS.postal,
      phone: SAMPLE_BUSINESS.phone,
      website: SAMPLE_BUSINESS.website,
      startDate: SAMPLE_BUSINESS.started,
      employees: String(SAMPLE_BUSINESS.employees),
      estimatedRevenue: money(SAMPLE_BUSINESS.annualRevenue),
      industry: SAMPLE_BUSINESS.industry,
      naicsCode: SAMPLE_BUSINESS.naics,
    },
    applicant: {
      firstName: SAMPLE_CONTACT.firstName,
      lastName: SAMPLE_CONTACT.lastName,
      fullName: `${SAMPLE_CONTACT.firstName} ${SAMPLE_CONTACT.lastName}`,
      email: SAMPLE_CONTACT.email,
      phone: SAMPLE_CONTACT.phone,
      dob: SAMPLE_CONTACT.dob,
      ssn: SAMPLE_CONTACT.sin,
      street: SAMPLE_CONTACT.street,
      city: SAMPLE_CONTACT.city,
      state: SAMPLE_CONTACT.province,
      zip: SAMPLE_CONTACT.postal,
      ownership: SAMPLE_CONTACT.ownership,
      hasMultipleOwners: false,
      title: SAMPLE_CONTACT.title,
    },
    termsAccepted: true,
    shareAuthorization: true,
    infoConfirmed: true,
    typedSignature: `${SAMPLE_CONTACT.firstName} ${SAMPLE_CONTACT.lastName}`,
  };
}

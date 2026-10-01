export interface IndianStateOption {
  code: string;
  name: string;
}

export interface FirstProductInput {
  name: string;
  sku?: string;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  openingStock: number;
  minStockAlert: number;
}

export interface FirstCustomerInput {
  name: string;
  phone?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  openingBalance: number;
}

export interface OnboardingFormValues {
  // Step 1: Business Identity
  businessName: string;
  legalName?: string;
  businessType: string;
  phone: string;
  email?: string;
  gstin?: string;
  pan?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  currency: string;
  financialYearStart: string;

  // Step 2: Category
  businessCategory: string;

  // Step 3: Invoice Settings
  invoicePrefix: string;
  startingInvoiceNumber: number;
  termsAndConditions: string;
  initialCashFloat?: number;

  // Step 4: Optional Starter Assets
  addFirstProduct: boolean;
  firstProduct: FirstProductInput;
  addFirstCustomer: boolean;
  firstCustomer: FirstCustomerInput;
}

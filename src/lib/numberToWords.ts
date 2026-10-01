/**
 * Utility to convert numbers into Indian Rupee Words format (Lakhs, Crores)
 * e.g., 14250 -> "Rupees Fourteen Thousand Two Hundred Fifty Only"
 */

const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const tens = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function convertBelowThousand(num: number): string {
  let str = '';
  if (num >= 100) {
    str += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num >= 20) {
    str += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  }
  if (num > 0) {
    str += ones[num] + ' ';
  }
  return str.trim();
}

export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Rupees Zero Only';

  const absolute = Math.abs(amount);
  const rupees = Math.floor(absolute);
  const paise = Math.round((absolute - rupees) * 100);

  let result = '';

  const crores = Math.floor(rupees / 10000000);
  let rem = rupees % 10000000;

  const lakhs = Math.floor(rem / 100000);
  rem = rem % 100000;

  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;

  const hundreds = rem;

  if (crores > 0) {
    result += convertBelowThousand(crores) + ' Crore ';
  }
  if (lakhs > 0) {
    result += convertBelowThousand(lakhs) + ' Lakh ';
  }
  if (thousands > 0) {
    result += convertBelowThousand(thousands) + ' Thousand ';
  }
  if (hundreds > 0) {
    result += convertBelowThousand(hundreds) + ' ';
  }

  result = result.trim();
  let fullStr = result ? `Rupees ${result}` : 'Rupees Zero';

  if (paise > 0) {
    fullStr += ` and ${convertBelowThousand(paise)} Paise`;
  }

  fullStr += ' Only';
  return fullStr;
}

export function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

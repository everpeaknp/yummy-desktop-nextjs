
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const SCALES = ["", "Thousand", "Million", "Billion", "Trillion"];

// Helper to convert integer part
function convertNumber(number: number): string {
  if (number === 0) return "";

  if (number < 20) {
    return ONES[number];
  }

  if (number < 100) {
    const tens = Math.floor(number / 10);
    const ones = number % 10;
    if (ones === 0) {
      return TENS[tens];
    }
    return `${TENS[tens]} ${ONES[ones]}`;
  }

  if (number < 1000) {
    const hundreds = Math.floor(number / 100);
    const remainder = number % 100;
    if (remainder === 0) {
      return `${ONES[hundreds]} Hundred`;
    }
    return `${ONES[hundreds]} Hundred ${convertNumber(remainder)}`;
  }

  for (let i = SCALES.length - 1; i > 0; i--) {
    const scaleValue = Math.pow(1000, i);
    if (number >= scaleValue) {
      const scaleCount = Math.floor(number / scaleValue);
      const remainder = number % scaleValue;
      const suffix = SCALES[i];
      if (remainder === 0) {
        return `${convertNumber(scaleCount)} ${suffix}`;
      }
      return `${convertNumber(scaleCount)} ${suffix} ${convertNumber(remainder)}`;
    }
  }

  return "";
}

export function numberToWords(amount: number, currency = "Rupees"): string {
  if (amount === 0) return "Zero " + currency;

  const wholePart = Math.floor(amount);
  const decimalPart = Math.round((amount - wholePart) * 100);

  const wholeWords = convertNumber(wholePart).trim();
  const currencyWord = wholePart === 1 ? currency.slice(0, -1) : currency;

  let result = `${wholeWords} ${currencyWord}`;

  if (decimalPart > 0) {
    const decimalWords = convertNumber(decimalPart).trim();
    const paisaWord = "Paisa"; // Plural/Singular handling if needed
    result += ` and ${decimalWords} ${paisaWord}`;
  } else {
    result += " Only";
  }

  return result;
}

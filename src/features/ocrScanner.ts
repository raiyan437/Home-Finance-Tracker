export interface OcrParseResult {
  title?: string;
  amountCents?: number;
  date?: string;
  success: boolean;
}

/**
 * Checks if a string token is a Bangladeshi phone number or a 4-digit year.
 */
export const isPhoneNumberOrYear = (str: string): boolean => {
  const clean = str.replace(/[\s\-+()]/g, '');
  // Bangladeshi phone numbers: 013..., 014..., 015..., 016..., 017..., 018..., 019..., +8801...
  const isPhone = /^(8801|880|01)[3-9]\d{8}$/.test(clean) || /^(01)[3-9]\d{8}$/.test(clean);
  // 4-digit years: 2024, 2025, 2026, etc.
  const isYear = /^(19|20)\d{2}$/.test(clean);
  return isPhone || isYear;
};

/**
 * Filters raw OCR text tokens to ignore phone numbers and dates when extracting total monetary amount.
 */
export const extractTotalFromOcrText = (text: string): number | null => {
  const lines = text.split('\n');
  const labeledAmounts: number[] = [];
  const candidateAmounts: number[] = [];

  lines.forEach((line) => {
    // Ignore lines that look purely like phone numbers or dates
    if (isPhoneNumberOrYear(line)) return;

    const matches = line.match(/(?:৳|Tk|BDT|\$)?\s*(\d+(?:\.\d{1,2})?)/gi);
    if (matches) {
      matches.forEach((m) => {
        const numStr = m.replace(/[^\d.]/g, '');
        if (numStr && !isPhoneNumberOrYear(numStr)) {
          const val = parseFloat(numStr);
          if (!isNaN(val) && val > 0 && val < 500000) {
            const cents = Math.round(val * 100);
            candidateAmounts.push(cents);
            if (/\b(grand\s*total|net\s*total|amount\s*due|total)\b/i.test(line)) labeledAmounts.push(cents);
          }
        }
      });
    }
  });

  if (labeledAmounts.length > 0) return labeledAmounts[labeledAmounts.length - 1];
  return candidateAmounts.length > 0 ? Math.max(...candidateAmounts) : null;
};

const extractDate = (text: string): string | undefined => {
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  const local = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null;
  if (!parts) return undefined;
  const value = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? undefined : value;
};

const extractMerchant = (text: string): string | undefined =>
  text
    .split('\n')
    .map((line) => line.trim())
    .find(
      (line) =>
        line.length >= 3 &&
        line.length <= 80 &&
        /[A-Za-z\u0980-\u09FF]/.test(line) &&
        !/\b(receipt|invoice|date|time|phone|mobile|total|vat|tax|cash|change)\b/i.test(line)
    );

/**
 * Image Canvas OCR receipt parser extracting merchant name, date, and amount in Taka (৳).
 */
export const scanReceiptImage = async (base64Image: string): Promise<OcrParseResult> => {
  let worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>> | null = null;
  try {
    const { createWorker } = await import('tesseract.js');
    worker = await createWorker('eng');
    const result = await worker.recognize(base64Image);
    const text = result.data.text.trim();
    if (!text) return { success: false };
    return {
      title: extractMerchant(text) || 'Scanned Receipt',
      amountCents: extractTotalFromOcrText(text) || undefined,
      date: extractDate(text),
      success: true,
    };
  } catch (error) {
    console.warn('Receipt OCR failed:', error);
    return { success: false };
  } finally {
    if (worker) await worker.terminate();
  }
};

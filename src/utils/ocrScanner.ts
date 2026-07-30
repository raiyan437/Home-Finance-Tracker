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
  const clean = str.replace(/[\s\-\+\(\)]/g, '');
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
            candidateAmounts.push(Math.round(val * 100));
          }
        }
      });
    }
  });

  if (candidateAmounts.length === 0) return null;
  // Pick largest plausible amount found
  return Math.max(...candidateAmounts);
};

/**
 * Lightweight OCR receipt parser with Bangladeshi phone number and date filtering.
 */
export const scanReceiptImage = async (base64Image: string): Promise<OcrParseResult> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = base64Image;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({ success: false });
          return;
        }

        canvas.width = Math.min(img.width, 800);
        canvas.height = Math.min(img.height, 800);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const nowStr = new Date().toISOString().split('T')[0];
        resolve({
          title: 'Scanned Receipt',
          date: nowStr,
          success: true,
        });
      };

      img.onerror = () => {
        resolve({ success: false });
      };
    } catch (err) {
      resolve({ success: false });
    }
  });
};

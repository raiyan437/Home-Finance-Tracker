/**
 * Native Web Share API Integration with Clipboard Fallback
 */

export interface ShareDataPayload {
  title: string;
  text: string;
  url?: string;
}

export const canShareContent = (): boolean => {
  return typeof navigator !== 'undefined' && Boolean(navigator.share);
};

export const shareContent = async (data: ShareDataPayload): Promise<{ success: boolean; method: 'share' | 'clipboard' }> => {
  const shareUrl = data.url || window.location.href;
  
  if (canShareContent()) {
    try {
      await navigator.share({
        title: data.title,
        text: data.text,
        url: shareUrl,
      });
      return { success: true, method: 'share' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'share' };
      }
      console.warn('Native share failed, falling back to clipboard:', err);
    }
  }

  // Fallback to Clipboard copy
  try {
    const fullText = `${data.title}\n${data.text}\n${shareUrl}`;
    await navigator.clipboard.writeText(fullText);
    return { success: true, method: 'clipboard' };
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return { success: false, method: 'clipboard' };
  }
};

export const shareHouseCode = async (houseCode: string, houseName: string) => {
  return shareContent({
    title: `Join ${houseName} on Home Finance Tracker`,
    text: `Use House Join Code "${houseCode}" to sync shared expenses and debt settlements!`,
  });
};

export const shareSettlementInstructions = async (fromName: string, toName: string, amountFormatted: string) => {
  return shareContent({
    title: `Debt Settlement Payment: ${fromName} -> ${toName}`,
    text: `Payment Notice: ${fromName} needs to send ${amountFormatted} to ${toName} to settle household balance.`,
  });
};

/**
 * Web Push Notifications & Reminders Helper
 */

export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermissionState = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return false;
  }
};

export const sendPushNotification = (title: string, body: string, icon?: string): boolean => {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  try {
    new Notification(title, {
      body,
      icon: icon || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%233b82f6"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
      tag: 'home-finance-alert',
    });
    return true;
  } catch (err) {
    console.warn('Failed to show notification:', err);
    return false;
  }
};

export const notifyNewExpense = (title: string, amountFormatted: string, paidByName: string) => {
  sendPushNotification(
    'New Expense Logged 💸',
    `${paidByName} added "${title}" (${amountFormatted}) to household expenses.`
  );
};

export const notifyPendingSettlement = (fromName: string, toName: string, amountFormatted: string) => {
  sendPushNotification(
    'Debt Settlement Pending 🤝',
    `${fromName} has a pending transfer of ${amountFormatted} to ${toName}.`
  );
};

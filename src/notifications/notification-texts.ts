export type AppLanguage = 'ar' | 'en';

interface NotificationText {
  title: string;
  body: string;
}

export function formatAmount(amountPiastres: number, currency: string, language: AppLanguage): string {
  const amount = (amountPiastres / 100).toFixed(2);
  if (language === 'en') return `${currency} ${amount}`;
  const label = currency === 'EGP' ? 'ج.م' : currency;
  return `${amount} ${label}`;
}

export const notificationTexts = {
  invitation(language: AppLanguage, params: { groupName: string }): NotificationText {
    return language === 'en'
      ? { title: 'New Invitation 🎉', body: `You've been invited to join "${params.groupName}"` }
      : { title: 'دعوة جديدة 🎉', body: `تمت دعوتك للانضمام إلى مجموعة "${params.groupName}"` };
  },

  removed(language: AppLanguage, params: { groupName: string }): NotificationText {
    return language === 'en'
      ? { title: 'Removed from a group', body: `You're no longer a member of "${params.groupName}"` }
      : { title: 'تمت إزالتك من مجموعة', body: `لم تعد عضواً في مجموعة "${params.groupName}"` };
  },

  memberJoined(language: AppLanguage, params: { userName: string; groupName: string }): NotificationText {
    return language === 'en'
      ? { title: 'New member joined! 🎊', body: `${params.userName} joined "${params.groupName}"` }
      : { title: 'عضو جديد انضم! 🎊', body: `${params.userName} انضم إلى "${params.groupName}"` };
  },

  shareAssigned(
    language: AppLanguage,
    params: { initiatorName: string; groupName: string; amountPiastres: number; currency: string },
  ): NotificationText {
    const amount = formatAmount(params.amountPiastres, params.currency, language);
    return language === 'en'
      ? {
          title: 'New Bill 🧾',
          body: `${params.initiatorName} added a new bill in ${params.groupName} — your share is ${amount}`,
        }
      : {
          title: 'فاتورة جديدة 🧾',
          body: `${params.initiatorName} أضاف فاتورة جديدة في ${params.groupName} — نصيبك ${amount}`,
        };
  },

  shareUpdated(
    language: AppLanguage,
    params: { editorName: string; amountPiastres: number; currency: string; billTitle: string },
  ): NotificationText {
    const amount = formatAmount(params.amountPiastres, params.currency, language);
    return language === 'en'
      ? {
          title: 'Your share changed',
          body: `${params.editorName} updated ${params.billTitle} — your share is now ${amount}`,
        }
      : { title: 'تغيّر نصيبك', body: `${params.editorName} عدّل ${params.billTitle} — نصيبك الآن ${amount}` };
  },

  shareRemoved(
    language: AppLanguage,
    params: { editorName: string; billTitle: string },
  ): NotificationText {
    return language === 'en'
      ? { title: 'Removed from a bill', body: `${params.editorName} removed you from ${params.billTitle} — you no longer owe anything on it` }
      : { title: 'تمت إزالتك من فاتورة', body: `${params.editorName} أزالك من ${params.billTitle} — لا يوجد عليك أي مبلغ فيها بعد الآن` };
  },

  shareInitiated(
    language: AppLanguage,
    params: { ownerName: string; amountPiastres: number; currency: string; billTitle: string },
  ): NotificationText {
    const amount = formatAmount(params.amountPiastres, params.currency, language);
    return language === 'en'
      ? { title: 'Payment in progress', body: `${params.ownerName} started paying ${amount} for ${params.billTitle}` }
      : { title: 'دفعة قيد التنفيذ', body: `${params.ownerName} بدأ دفع مبلغ ${amount} لـ ${params.billTitle}` };
  },

  shareSettled(
    language: AppLanguage,
    params: { initiatorName: string; amountPiastres: number; currency: string; billTitle: string },
  ): NotificationText {
    const amount = formatAmount(params.amountPiastres, params.currency, language);
    return language === 'en'
      ? {
          title: 'Payment confirmed ✅',
          body: `${params.initiatorName} confirmed receiving ${amount} for ${params.billTitle}`,
        }
      : { title: 'تم تأكيد الدفع ✅', body: `${params.initiatorName} أكد استلام ${amount} لـ ${params.billTitle}` };
  },

  shareReminder(
    language: AppLanguage,
    params: { initiatorName: string; amountPiastres: number; currency: string; billTitle: string; groupName: string },
  ): NotificationText {
    const amount = formatAmount(params.amountPiastres, params.currency, language);
    return language === 'en'
      ? {
          title: 'Payment reminder',
          body: `${params.initiatorName} is reminding you to pay ${amount} for ${params.billTitle} in ${params.groupName}`,
        }
      : {
          title: 'تذكير بالدفع',
          body: `${params.initiatorName} يذكرك بدفع ${amount} لـ ${params.billTitle} في ${params.groupName}`,
        };
  },

  shareStaleNudge(
    language: AppLanguage,
    params: { amountPiastres: number; currency: string; billTitle: string },
  ): NotificationText {
    const amount = formatAmount(params.amountPiastres, params.currency, language);
    return language === 'en'
      ? {
          title: 'Payment awaiting confirmation',
          body: `You have a payment of ${amount} awaiting confirmation of receipt for ${params.billTitle}`,
        }
      : {
          title: 'دفعة في انتظار التأكيد',
          body: `لديك دفعة بقيمة ${amount} في انتظار تأكيد الاستلام لـ ${params.billTitle}`,
        };
  },
};

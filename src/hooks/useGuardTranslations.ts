import guardTranslations from '../i18n/guard.json';

export function useGuardTranslations() {
  const t = guardTranslations.deletion;

  return {
    title: t.title,
    subtitle: t.subtitle,
    sections: {
      blocking: {
        title: t.sections.blocking.title,
        badge: t.sections.blocking.badge
      },
      info: {
        title: t.sections.info.title,
        badge: t.sections.info.badge,
        help: t.sections.info.help
      }
    },
    actions: {
      ok: t.actions.ok,
      seeLeases: t.actions.seeLeases,
      seeLoans: t.actions.seeLoans,
      seePayments: t.actions.seePayments,
      seeInstallments: t.actions.seeInstallments
    },
    blockers: {
      leases: {
        label: t.blockers.Lease.label,
        hint: t.blockers.Lease.hint
      },
      loans: {
        label: t.blockers.Loan.label,
        hint: t.blockers.Loan.hint
      },
      installments: {
        label: t.blockers.installments.label,
        hint: t.blockers.installments.hint
      }
    },
    info: {
      occupants: t.info.occupants,
      transactions: t.info.Transaction,
      documents: t.info.Document,
      photos: t.info.Photo,
      payments: t.info.payments
    }
  };
}

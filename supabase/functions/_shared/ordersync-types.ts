export type OrderSyncProfile = {
  id: string
  nome: string | null
  plano: string | null
  subscription_status: string | null
  trial_ends_at?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
  payment_provider?: string | null
  stripe_subscription_id?: string | null
}

export type OrderSyncOrganization = {
  id: string
  nome: string | null
  plano: string | null
  subscription_status: string | null
  trial_ends_at?: string | null
  current_period_end?: string | null
  cancel_at_period_end?: boolean | null
  payment_provider?: string | null
  seats?: number | null
  stripe_subscription_id?: string | null
}

export type OrderSyncOrganizationMember = {
  org_id: string
  user_id: string
  status: string | null
}

export type OrderSyncPixPayment = {
  user_id: string | null
  org_id: string | null
  status: string | null
  plan: string | null
  amount_cents: number | null
  currency: string | null
  access_ends_at: string | null
  paid_at: string | null
}

/** Latest known state of a Stripe subscription, taken from the source's webhook log. */
export type OrderSyncStripeSubscription = {
  subscription_id: string
  status: string | null
  period_end: string | null
  amount_cents: number | null
  currency: string | null
}

/** One paid period of a Stripe subscription (the source's webhook log has no invoices). */
export type OrderSyncStripePayment = {
  subscription_id: string
  paid_at: string | null
  amount_cents: number | null
  currency: string | null
}

export type OrderSyncRecords = {
  profiles: OrderSyncProfile[]
  organizations: OrderSyncOrganization[]
  organizationMembers: OrderSyncOrganizationMember[]
  pixPayments: OrderSyncPixPayment[]
  stripeSubscriptions?: OrderSyncStripeSubscription[]
  stripePayments?: OrderSyncStripePayment[]
}

export type NormalizedSubscriptionFact = {
  externalId: string
  entityKind: 'individual' | 'organization'
  displayName: string | null
  plan: string | null
  status: string
  periodEndAt: string | null
  trialEndAt: string | null
  cancelAtPeriodEnd: boolean | null
  seatCount: number | null
  amountCents: number | null
  currency: string | null
  provider: string | null
  /** How the customer pays: 'pix', 'stripe' (card) or the source's provider when unknown. */
  paymentMethod: string | null
  paymentsCount: number
  firstPaidAt: string | null
  lastPaidAt: string | null
  observedAt: string
}

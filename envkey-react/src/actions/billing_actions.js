import { createAction } from 'redux-actions'
import R from 'ramda'
import {
  BILLING_UPGRADE_SUBSCRIPTION,
  BILLING_CANCEL_SUBSCRIPTION,
  BILLING_UPDATE_CARD,
  BILLING_UPDATE_CARD_REQUEST,
  BILLING_STRIPE_FORM_SUBMITTED,
  BILLING_STRIPE_FORM_CLOSED,
  BILLING_UPDATE_SUBSCRIPTION_REQUEST,
  BILLING_FETCH_INVOICE_LIST_REQUEST,
  BILLING_FETCH_INVOICE_PDF,
  BILLING_FETCH_INVOICE_PDF_REQUEST,
} from './action_types'

export const billingUpgradeSubscription = createAction(
    BILLING_UPGRADE_SUBSCRIPTION
  ),
  billingUpdateSubscriptionRequest = createAction(
    BILLING_UPDATE_SUBSCRIPTION_REQUEST,
    R.pick(['stripeToken', 'planId', 'retainUserIds', 'retainAppIds']),
    R.pick(['updateType'])
  ),
  billingCancelSubscription = createAction(
    BILLING_CANCEL_SUBSCRIPTION,
    R.pick(['retainUserIds', 'retainAppIds'])
  ),
  billingUpdateCard = createAction(BILLING_UPDATE_CARD),
  billingUpdateCardRequest = createAction(
    BILLING_UPDATE_CARD_REQUEST,
    R.pick(['stripeToken'])
  ),
  billingStripeFormSubmitted = createAction(
    BILLING_STRIPE_FORM_SUBMITTED,
    R.pick(['stripeToken'])
  ),
  billingStripeFormClosed = createAction(BILLING_STRIPE_FORM_CLOSED),
  billingFetchInvoiceList = createAction(BILLING_FETCH_INVOICE_LIST_REQUEST),
  billingFetchInvoicePdf = createAction(BILLING_FETCH_INVOICE_PDF),
  billingFetchInvoicePdfRequest = createAction(
    BILLING_FETCH_INVOICE_PDF_REQUEST,
    R.pick(['id']),
    R.pick(['filename'])
  )

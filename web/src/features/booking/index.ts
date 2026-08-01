/** Public API of the booking feature. Other features import ONLY from here. */
export { CheckoutPanel } from './components/checkout-panel';
export { holdSlotsAction, confirmBookingAction } from './actions';
export type { HoldResult, ConfirmResult } from './actions';

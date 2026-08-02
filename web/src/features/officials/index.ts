/** Public API of the officials feature. */
export { RegisterOfficialForm } from './components/register-form';
export { ConfirmResultPanel } from './components/confirm-result-panel';
export { OfficialPicker, type AssignmentState } from './components/official-picker';
export type { OfficialSummary } from './actions';
export {
  registerOfficialAction,
  confirmResultAction,
  proposeOfficialAction,
  confirmOfficialAction,
  collectOfficialFeeAction,
} from './actions';

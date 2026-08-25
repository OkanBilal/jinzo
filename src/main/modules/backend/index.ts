// IPC
export { registerBackendIpc, unregisterBackendIpc } from "./backend.ipc";

// Service
export {
  backendService,
  buildPairingLink,
  clearPairingCodes,
} from "./backend.service";

// Repository (module-internal — not exported)

// Validation
export { parsePairDeviceInput } from "./backend.validation";

// DTOs
export type {
  BackendDescriptor,
  PairedDevice,
  PairedDevicePlatform,
  PairingCode,
  PairDeviceInput,
  PairDeviceResult,
} from "./backend.dto";

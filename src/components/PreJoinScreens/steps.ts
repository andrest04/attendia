// The Steps enum lives in its own leaf module so DeviceSelectionScreen can import it
// without creating an import cycle through PreJoinScreens.tsx (which renders DeviceSelectionScreen).
export enum Steps {
  roomNameStep,
  deviceSelectionStep,
}

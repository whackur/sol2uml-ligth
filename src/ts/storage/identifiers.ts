let storageId = 1
let variableId = 1

// Keep IDs process-global so later conversions continue the existing sequence.
export const nextStorageId = (): number => storageId++
export const nextVariableId = (): number => variableId++

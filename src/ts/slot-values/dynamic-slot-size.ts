export const dynamicSlotSize = (variable: {
    name?: string
    type?: string
    slotValue?: string
}): number => {
    try {
        if (!variable?.slotValue) throw Error(`Missing slot value.`)
        const last4bits = '0x' + variable.slotValue.slice(-1)
        const last4bitsNum = Number(BigInt(last4bits))
        // Long dynamic values encode their byte length in the low bit.
        if (last4bitsNum % 2 === 0) return 0

        const sizeRaw = Number(BigInt(variable.slotValue))
        return (sizeRaw - 1) / 2
    } catch (err) {
        throw Error(
            `Failed to calculate dynamic slot size for variable "${variable?.name}" of type "${variable?.type}" with slot value ${variable?.slotValue}`,
            { cause: err },
        )
    }
}

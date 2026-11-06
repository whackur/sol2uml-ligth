import { toBeHex } from 'ethers'
import type { BigNumberish } from 'ethers'

const debug = require('debug')('sol2uml-light')

// Keys are hexadecimal slot numbers, such as 0x0 or 0x1.
type SlotCache = { [key: string]: string }

// The existing cache is process-global and assumes one contract and block.
export class SlotValueCache {
    private static slotCache: SlotCache = {}

    public static readSlotValues(slotKeys: readonly BigNumberish[]): {
        cachedValues: string[]
        missingKeys: string[]
    } {
        const cachedValues: string[] = []
        const missingKeys: string[] = []
        slotKeys.forEach((slotKey) => {
            const key = toBeHex(BigInt(slotKey))
            if (this.slotCache[key]) {
                cachedValues.push(this.slotCache[key])
            } else {
                missingKeys.push(key)
            }
        })

        return { cachedValues, missingKeys }
    }

    public static addSlotValues(
        slotKeys: readonly BigNumberish[],
        missingKeys: readonly string[],
        missingValues: readonly string[],
    ): string[] {
        if (missingKeys?.length !== missingValues?.length) {
            throw Error(
                `${missingKeys?.length} keys does not match ${missingValues?.length} values`,
            )
        }
        missingKeys.forEach((key, i) => {
            if (!this.slotCache[key]) {
                debug(`cached slot ${key} with ${missingValues[i]}`)
                this.slotCache[key] = missingValues[i]
            }
        })
        return slotKeys.map((slotKey) => {
            const key = toBeHex(BigInt(slotKey))
            return this.slotCache[key]
        })
    }

    // Keep this reset for tests that run against separate contracts and blocks.
    public static clear() {
        this.slotCache = {}
    }
}

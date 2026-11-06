import { dynamicSlotSize, escapeString, parseValue } from '../slotValues.js'
import { AttributeType } from '../umlClass.js'

describe('Slot Values parsing', () => {
    describe('calc dynamic slot size for string value', () => {
        test.each`
            slotValue                                                               | expected
            ${'0x0000000000000000000000000000000000000000000000000000000000000000'} | ${0}
            ${'0x1000000000000000000000000000000000000000000000000000000000000000'} | ${0}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00'} | ${0}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0'} | ${0}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFE'} | ${0}
            ${'0x0000000000000000000000000000000000000000000000000000000000000001'} | ${0}
            ${'0x0000000000000000000000000000000000000000000000000000000000000002'} | ${0}
            ${'0x0000000000000000000000000000000000000000000000000000000000000003'} | ${1}
            ${'0x0000000000000000000000000000000000000000000000000000000000000009'} | ${4}
            ${'0x000000000000000000000000000000000000000000000000000000000000000B'} | ${5}
            ${'0x0000000000000000000000000000000000000000000000000000000000000015'} | ${10}
            ${'0x000000000000000000000000000000000000000000000000000000000000003F'} | ${31}
            ${'0x0000000000000000000000000000000000000000000000000000000000000040'} | ${0}
            ${'0x0000000000000000000000000000000000000000000000000000000000000041'} | ${32}
            ${'0x0000000000000000000000000000000000000000000000000000000000000042'} | ${0}
            ${'0x0000000000000000000000000000000000000000000000000000000000000043'} | ${33}
            ${'0x0000000000000000000000000000000000000000000000000000000000000101'} | ${128}
            ${'0x0000000000000000000000000000000000000000000000000000000000100001'} | ${524288}
        `('$value', ({ slotValue, expected }) => {
            expect(dynamicSlotSize({ slotValue })).toEqual(expected)
        })
    })
    describe('parse value from slot data', () => {
        const baseVariable = {
            id: 1,
            fromSlot: 0,
            toSlot: 0,
            attributeType: AttributeType.Elementary,
            getValue: true,
            displayValue: true,
            dynamic: false,
        }
        test.each`
            value                                                                   | type         | byteOffset | byteSize | dynamic  | expected
            ${'0x0000000000000000000000000000000000000000000000000000000000000000'} | ${'bool'}    | ${0}       | ${1}     | ${false} | ${'false'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000100'} | ${'bool'}    | ${0}       | ${1}     | ${false} | ${'false'}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00'} | ${'bool'}    | ${0}       | ${1}     | ${false} | ${'false'}
            ${'0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'} | ${'bool'}    | ${31}      | ${1}     | ${false} | ${'false'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000001'} | ${'bool'}    | ${0}       | ${1}     | ${false} | ${'true'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000100'} | ${'bool'}    | ${1}       | ${1}     | ${false} | ${'true'}
            ${'0x0100000000000000000000000000000000000000000000000000000000000000'} | ${'bool'}    | ${31}      | ${1}     | ${false} | ${'true'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000000'} | ${'string'}  | ${0}       | ${32}    | ${false} | ${'\\"\\"'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000000'} | ${'string'}  | ${0}       | ${32}    | ${true}  | ${'\\"\\"'}
            ${'0x5400000000000000000000000000000000000000000000000000000000000002'} | ${'string'}  | ${0}       | ${32}    | ${true}  | ${'\\"T\\"'}
            ${'0x5465737453746F7261676520636F6E7472616374000000000000000000000028'} | ${'string'}  | ${0}       | ${32}    | ${true}  | ${'\\"TestStorage contract\\"'}
            ${'0x65786163746C7920333220636861727320736F2075736573203220736C6F7473'} | ${'string'}  | ${0}       | ${32}    | ${false} | ${'\\"exactly 32 chars so uses 2 slots\\"'}
            ${'0x20746872656520736C6F74730000000000000000000000000000000000000000'} | ${'string'}  | ${20}      | ${12}    | ${false} | ${'\\" three slots\\"'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000041'} | ${'string'}  | ${0}       | ${32}    | ${true}  | ${'32'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000099'} | ${'string'}  | ${0}       | ${32}    | ${true}  | ${'76'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000101'} | ${'string'}  | ${0}       | ${32}    | ${true}  | ${'128'}
            ${'0xFFEEDDCCBBAA9988770011000000000000000000000000000000000000000016'} | ${'bytes'}   | ${0}       | ${32}    | ${true}  | ${'0xFFEEDDCCBBAA9988770011'}
            ${'0xEC0B854938343F85EB39A6648B9E449C2E4AEE4DC9B4E96AB592F9F497D0513E'} | ${'bytes'}   | ${0}       | ${32}    | ${true}  | ${'0xEC0B854938343F85EB39A6648B9E449C2E4AEE4DC9B4E96AB592F9F497D051'}
            ${'0x2619EC68B255542E3DA68C054BFE0D7D0F27B7FDBEFC8BBCCDD23188FC71FE7F'} | ${'bytes'}   | ${0}       | ${32}    | ${false} | ${'0x2619EC68B255542E3DA68C054BFE0D7D0F27B7FDBEFC8BBCCDD23188FC71FE7F'}
            ${'0x2619EC68B255542E3DA68C054BFE0D7D0F27B7FDBEFC8BBCCDD23188FC71FE7F'} | ${'bytes32'} | ${0}       | ${32}    | ${false} | ${'0x2619EC68B255542E3DA68C054BFE0D7D0F27B7FDBEFC8BBCCDD23188FC71FE7F'}
            ${'0x2619EC68B255542E3DA68C054BFE0D7D0F27B7FDBEFC8BBCCDD23188FC71FE7F'} | ${'bytes1'}  | ${0}       | ${1}     | ${false} | ${'0x7F'}
            ${'0x000000000000000000000000E2F2A5C287993345A840DB3B0845FBC70F5935A5'} | ${'address'} | ${0}       | ${20}    | ${false} | ${'0xe2f2a5C287993345a840Db3B0845fbC70f5935a5'}
            ${'0xE2F2A5C287993345A840DB3B0845FBC70F5935A5000000000000000000000000'} | ${'address'} | ${12}      | ${20}    | ${false} | ${'0xe2f2a5C287993345a840Db3B0845fbC70f5935a5'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000000'} | ${'uint256'} | ${0}       | ${32}    | ${false} | ${'0'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000001'} | ${'uint256'} | ${0}       | ${32}    | ${false} | ${'1'}
            ${'0x000000000000000000000000000000000000000000000000000000000000000A'} | ${'uint256'} | ${0}       | ${32}    | ${false} | ${'10'}
            ${'0x000000000000000000000000000000000000000000000000FEDCBA9876543210'} | ${'uint256'} | ${0}       | ${32}    | ${false} | ${'18,364,758,544,493,064,720'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000001'} | ${'uint'}    | ${0}       | ${32}    | ${false} | ${'1'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000001'} | ${'uint8'}   | ${0}       | ${1}     | ${false} | ${'1'}
            ${'0x00000000000000000000000000000000000000000000000000000000000000FF'} | ${'uint8'}   | ${0}       | ${1}     | ${false} | ${'255'}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00'} | ${'uint8'}   | ${0}       | ${1}     | ${false} | ${'0'}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF01'} | ${'uint8'}   | ${0}       | ${1}     | ${false} | ${'1'}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'} | ${'uint8'}   | ${0}       | ${1}     | ${false} | ${'255'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000000'} | ${'int256'}  | ${0}       | ${32}    | ${false} | ${'0'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000001'} | ${'int256'}  | ${0}       | ${32}    | ${false} | ${'1'}
            ${'0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'} | ${'int256'}  | ${0}       | ${32}    | ${false} | ${'57,896,044,618,658,097,711,785,492,504,343,953,926,634,992,332,820,282,019,728,792,003,956,564,819,967'}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'} | ${'int256'}  | ${0}       | ${32}    | ${false} | ${'-1'}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFC01'} | ${'int256'}  | ${0}       | ${32}    | ${false} | ${'-1,023'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000001'} | ${'int8'}    | ${0}       | ${1}     | ${false} | ${'1'}
            ${'0x00000000000000000000000000000000000000000000000000000000000000FF'} | ${'int8'}    | ${0}       | ${1}     | ${false} | ${'-1'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000080'} | ${'int8'}    | ${0}       | ${1}     | ${false} | ${'-128'}
            ${'0x0000000000000000000000000000000000000000000000000000000000000001'} | ${'uint'}    | ${0}       | ${32}    | ${false} | ${'1'}
            ${'0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'} | ${'int'}     | ${0}       | ${32}    | ${false} | ${'-1'}
        `(
            '$type offset $byteOffset size $byteSize $value',
            ({ byteOffset, byteSize, value, type, dynamic, expected }) => {
                expect(
                    parseValue({
                        ...baseVariable,
                        byteSize,
                        byteOffset,
                        type,
                        slotValue: value,
                        dynamic,
                    }),
                ).toEqual(expected)
            },
        )
    })
    describe('escape string', () => {
        test.each`
            text               | expected
            ${'"Some string"'} | ${'\\"Some string\\"'}
            ${'size < 31'}     | ${'size \\< 31'}
            ${'size >= 31'}    | ${'size \\>= 31'}
            ${'1 & 2'}         | ${'1 \\& 2'}
            ${'"<&>'}          | ${'\\"\\<\\&\\>'}
            ${'""<<&&>>>'}     | ${'\\"\\"\\<\\<\\&\\&\\>\\>\\>'}
        `('text $text', ({ text, expected }) => {
            expect(escapeString(text)).toEqual(expected)
        })
    })
})

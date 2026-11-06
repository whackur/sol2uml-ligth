import { readFile } from 'fs'
import { convertDot2Svg } from '../writerFiles.js'

describe('Converter', () => {
    test('converts a valid DOT fixture to SVG', (done) => {
        readFile('./src/ts/__tests__/SomeImpl.dot', (err, dotBuf) => {
            if (err) {
                throw err
            }

            const dotString = dotBuf.toString('utf8')
            const svg = convertDot2Svg(dotString)
            expect(typeof svg).toEqual('string')
            expect(svg.length).toBeGreaterThan(2000)

            done()
        })
    })
})

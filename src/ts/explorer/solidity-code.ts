import type { UmlClass } from '../umlClass.js'
import { topologicalSortClasses } from '../filterClasses.js'
import { parseSolidityVersion } from './solidity-version.js'
import type { ExplorerSourceFile } from './source-code-types.js'

const debug = require('debug')('sol2uml-light')

export const flattenSolidityFiles = (
    files: ExplorerSourceFile[],
    umlClasses: UmlClass[],
    compilerVersion: string,
): string => {
    const topologicalSortedClasses = topologicalSortClasses(umlClasses)
    const sortedFilenames = topologicalSortedClasses.map(
        (umlClass) => umlClass.relativePath,
    )
    const dependentFilenames = [...new Set(sortedFilenames)]
    const nonDependentFiles = files.filter(
        (file) => !dependentFilenames.includes(file.filename),
    )
    const nonDependentFilenames = nonDependentFiles.map((file) => file.filename)
    if (nonDependentFilenames.length) {
        debug(`Failed to find dependencies to files: ${nonDependentFilenames}`)
    }

    const solidityVersion = parseSolidityVersion(compilerVersion)
    let solidityCode = `pragma solidity =${solidityVersion};\n`
    // Put files without detected dependencies first in case dependency analysis missed an edge.
    const filenames = [...nonDependentFilenames, ...dependentFilenames]

    filenames.forEach((filename) => {
        const file = files.find(
            (sourceFile) => sourceFile.filename === filename,
        )
        if (!file)
            throw Error(`Failed to find file with filename "${filename}"`)

        // The compiler version above replaces source pragmas in the merged file.
        const removedPragmaSolidity = file.code.replace(
            /(\s)(pragma\s+solidity.*;)/gm,
            '$1/* $2 */',
        )
        // Imports are represented by their flattened source content.
        const removedImports = removedPragmaSolidity.replace(
            /^\s*?(import.*?;)/gms,
            '/* $1 */',
        )
        // Only one SPDX identifier can be active in the merged output.
        solidityCode += removedImports.replace(/SPDX-/, 'SPDX--')
    })
    return solidityCode
}

import { existsSync } from 'fs'
import * as path from 'path'
import { posix } from 'path'
import type { ImportDirective } from '@solidity-parser/parser/dist/src/ast-types'
import type { Import } from '../umlClass.js'
import { renameFile } from './remappings.js'
import type { Remapping } from './remappingTypes.js'

const debug = require('debug')('sol2uml-light')

export function resolveImport(
    node: ImportDirective,
    relativePath: string,
    remappings: Remapping[],
    filesystem: boolean,
    remappingsBase?: string,
): Import | undefined {
    const codeFolder = path.dirname(relativePath)
    if (filesystem) {
        try {
            const importPath = require.resolve(node.path, {
                paths: [codeFolder],
            })
            const newImport = {
                absolutePath: importPath,
                classNames: node.symbolAliases
                    ? node.symbolAliases.map((alias) => {
                          return {
                              className: alias[0],
                              alias: alias[1],
                          }
                      })
                    : [],
            }
            debug(
                `Added filesystem import ${newImport.absolutePath} with class names ${newImport.classNames.map(
                    (i) => i.className,
                )}`,
            )
            return newImport
        } catch {
            // Fallback: apply Foundry/soldeer remappings for non-npm imports
            if (remappings.length > 0 && remappingsBase) {
                const remappedPath = renameFile(node.path, remappings)
                if (remappedPath !== node.path) {
                    const absoluteRemappedPath = path.resolve(
                        remappingsBase,
                        remappedPath,
                    )
                    if (existsSync(absoluteRemappedPath)) {
                        const newImport = {
                            absolutePath: absoluteRemappedPath,
                            classNames: node.symbolAliases
                                ? node.symbolAliases.map((alias) => ({
                                      className: alias[0],
                                      alias: alias[1],
                                  }))
                                : [],
                        }
                        debug(
                            `Resolved import via remapping: ${node.path} → ${absoluteRemappedPath}`,
                        )
                        return newImport
                    }
                }
            }
            debug(
                `Failed to resolve import ${node.path} from file ${relativePath}`,
            )
            return undefined
        }
    }

    // This has come from Etherscan.
    const remappedFile = renameFile(node.path, remappings)
    const importPath =
        remappedFile[0] === '.'
            ? posix.join(codeFolder.toString(), remappedFile)
            : remappedFile
    debug(
        `codeFolder ${codeFolder} childNode.path ${node.path} remapped to ${remappedFile}`,
    )
    const newImport = {
        absolutePath: importPath,
        classNames: node.symbolAliases
            ? node.symbolAliases.map((alias) => {
                  return {
                      className: alias[0],
                      alias: alias[1],
                  }
              })
            : [],
    }
    debug(`Added Etherscan import ${newImport.absolutePath} with:`)
    newImport.classNames.forEach((className) => {
        debug(`\t alias ${className.className}, name ${className.className}`)
    })
    return newImport
}

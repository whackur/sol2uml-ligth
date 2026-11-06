import { Association, UmlClass } from './umlClass'

interface ImportChainEntry {
    source: UmlClass
    targetName: string
}

interface ResolutionIndex {
    classesById: Map<number, UmlClass>
    classesByName: Map<string, UmlClass[]>
    classesByPath: Map<string, UmlClass[]>
    classOrder: Map<UmlClass, number>
}

type InheritanceFrame =
    | { type: 'class'; umlClass: UmlClass }
    | {
          type: 'parent'
          source: UmlClass
          association: Association
      }

// Find the UML class linked to the association
export const findAssociatedClass = (
    association: Association,
    sourceUmlClass: UmlClass,
    umlClasses: readonly UmlClass[],
): UmlClass | undefined => {
    const index = createResolutionIndex(umlClasses)

    if (association.parentUmlClassName) {
        const owner = _findViaImportChain(
            {
                referenceType: association.referenceType,
                targetUmlClassName: association.parentUmlClassName,
            },
            sourceUmlClass,
            index,
        )
        if (!owner) return undefined

        return _findNestedTypeInAncestry(
            association.targetUmlClassName,
            owner,
            index,
        )
    }

    if (association.realization) {
        return _findViaImportChain(association, sourceUmlClass, index)
    }

    const lexicalClass =
        sourceUmlClass.parentId === undefined
            ? sourceUmlClass
            : (index.classesById.get(sourceUmlClass.parentId) ?? sourceUmlClass)

    const nestedType = _findNestedTypeInAncestry(
        association.targetUmlClassName,
        lexicalClass,
        index,
    )
    return nestedType ?? _findViaImportChain(association, sourceUmlClass, index)
}

const createResolutionIndex = (
    umlClasses: readonly UmlClass[],
): ResolutionIndex => {
    const index: ResolutionIndex = {
        classesById: new Map(),
        classesByName: new Map(),
        classesByPath: new Map(),
        classOrder: new Map(),
    }

    umlClasses.forEach((umlClass, order) => {
        if (!index.classesById.has(umlClass.id)) {
            index.classesById.set(umlClass.id, umlClass)
        }
        index.classOrder.set(umlClass, order)

        const sameName = index.classesByName.get(umlClass.name) ?? []
        sameName.push(umlClass)
        index.classesByName.set(umlClass.name, sameName)

        const samePath = index.classesByPath.get(umlClass.absolutePath) ?? []
        samePath.push(umlClass)
        index.classesByPath.set(umlClass.absolutePath, samePath)
    })

    return index
}

// Tests if source class can be linked to the target class via an association
const isAssociated = (
    association: Association,
    sourceUmlClass: UmlClass,
    targetUmlClass: UmlClass,
    targetParentUmlClass: UmlClass | undefined,
): boolean => {
    if (association.parentUmlClassName) {
        return (
            // class is in the same source file
            (association.targetUmlClassName === targetUmlClass.name &&
                association.parentUmlClassName === targetParentUmlClass?.name &&
                sourceUmlClass.absolutePath === targetUmlClass.absolutePath) ||
            // imported classes with no explicit import names
            (association.targetUmlClassName === targetUmlClass.name &&
                association.parentUmlClassName === targetParentUmlClass?.name &&
                sourceUmlClass.imports.some(
                    (i) =>
                        i.absolutePath === targetUmlClass.absolutePath &&
                        i.classNames.length === 0,
                )) ||
            // imported classes with explicit import names or import aliases
            sourceUmlClass.imports.some(
                (importLink) =>
                    importLink.absolutePath === targetUmlClass.absolutePath &&
                    importLink.classNames.some(
                        (importedClass) =>
                            // If a parent contract with no import alias
                            (association.targetUmlClassName ===
                                targetUmlClass.name &&
                                association.parentUmlClassName ===
                                    importedClass.className &&
                                importedClass.alias == undefined) ||
                            // If a parent contract with import alias
                            (association.targetUmlClassName ===
                                targetUmlClass.name &&
                                association.parentUmlClassName ===
                                    importedClass.alias),
                    ),
            )
        )
    }

    // No parent class in the association
    return (
        // class is in the same source file
        (association.targetUmlClassName === targetUmlClass.name &&
            sourceUmlClass.absolutePath === targetUmlClass.absolutePath) ||
        // imported classes with no explicit import names
        (association.targetUmlClassName === targetUmlClass.name &&
            sourceUmlClass.imports.some(
                (i) =>
                    i.absolutePath === targetUmlClass.absolutePath &&
                    i.classNames.length === 0,
            )) ||
        // imported classes with explicit import names or import aliases
        sourceUmlClass.imports.some(
            (importLink) =>
                importLink.absolutePath === targetUmlClass.absolutePath &&
                importLink.classNames.some(
                    (importedClass) =>
                        // no import alias
                        (association.targetUmlClassName ===
                            importedClass.className &&
                            importedClass.className === targetUmlClass.name &&
                            importedClass.alias == undefined) ||
                        // import alias
                        (association.targetUmlClassName ===
                            importedClass.alias &&
                            importedClass.className === targetUmlClass.name),
                ),
        )
    )
}

// Try to find a direct match for the association from the given source class
const _tryDirectMatch = (
    association: Association,
    sourceUmlClass: UmlClass,
    index: ResolutionIndex,
): UmlClass | undefined => {
    const candidateNames = new Set([association.targetUmlClassName])
    if (!association.parentUmlClassName) {
        for (const importLink of sourceUmlClass.imports) {
            for (const importedClass of importLink.classNames) {
                candidateNames.add(importedClass.className)
            }
        }
    }

    let result: UmlClass | undefined
    let resultOrder = Number.POSITIVE_INFINITY
    for (const candidateName of candidateNames) {
        for (const targetUmlClass of index.classesByName.get(candidateName) ??
            []) {
            const order = index.classOrder.get(targetUmlClass)!
            if (order >= resultOrder) continue
            if (
                !association.parentUmlClassName &&
                targetUmlClass.parentId !== undefined
            ) {
                continue
            }

            const targetParentClass =
                association.parentUmlClassName &&
                targetUmlClass.parentId !== undefined
                    ? index.classesById.get(targetUmlClass.parentId)
                    : undefined
            if (
                isAssociated(
                    association,
                    sourceUmlClass,
                    targetUmlClass,
                    targetParentClass,
                )
            ) {
                result = targetUmlClass
                resultOrder = order
            }
        }
    }
    return result
}

// Iterative BFS through import chain, trying a direct match at each level.
const _findViaImportChain = (
    association: Association,
    sourceUmlClass: UmlClass,
    index: ResolutionIndex,
): UmlClass | undefined => {
    const searched = new Set<string>()
    const queued = new Set<string>()
    const queue: ImportChainEntry[] = [
        {
            source: sourceUmlClass,
            targetName: association.targetUmlClassName,
        },
    ]
    queued.add(
        `${sourceUmlClass.absolutePath}::${association.targetUmlClassName}`,
    )

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex++) {
        const { source, targetName } = queue[queueIndex]
        const key = `${source.absolutePath}::${targetName}`
        if (searched.has(key)) continue
        searched.add(key)

        const currentAssoc: Association = {
            ...association,
            targetUmlClassName: targetName,
        }

        const match = _tryDirectMatch(currentAssoc, source, index)
        if (match) return match

        const imports = source.imports.filter(
            (importLink) =>
                importLink.classNames.length === 0 ||
                importLink.classNames.some(
                    (importedClass) =>
                        (targetName === importedClass.className &&
                            !importedClass.alias) ||
                        targetName === importedClass.alias,
                ),
        )

        const enqueue = (importedClass: UmlClass, nextTargetName: string) => {
            const nextKey = `${importedClass.absolutePath}::${nextTargetName}`
            if (searched.has(nextKey) || queued.has(nextKey)) return
            queue.push({ source: importedClass, targetName: nextTargetName })
            queued.add(nextKey)
        }

        for (const importDetail of imports) {
            const importedClass = index.classesByPath.get(
                importDetail.absolutePath,
            )?.[0]
            if (!importedClass) continue

            enqueue(importedClass, targetName)

            for (const importedName of importDetail.classNames) {
                if (importedName.alias && targetName === importedName.alias) {
                    enqueue(importedClass, importedName.className)
                }
            }
        }
    }

    return undefined
}

const _findNestedTypeInAncestry = (
    targetName: string,
    lexicalClass: UmlClass,
    index: ResolutionIndex,
): UmlClass | undefined => {
    const visitedClassIds = new Set<number>()
    const stack: InheritanceFrame[] = [
        { type: 'class', umlClass: lexicalClass },
    ]

    while (stack.length > 0) {
        const frame = stack.pop()!
        if (frame.type === 'parent') {
            const parent = _findViaImportChain(
                frame.association,
                frame.source,
                index,
            )
            if (parent && !visitedClassIds.has(parent.id)) {
                stack.push({ type: 'class', umlClass: parent })
            }
            continue
        }

        const currentClass = frame.umlClass
        if (visitedClassIds.has(currentClass.id)) continue
        visitedClassIds.add(currentClass.id)

        for (const nestedTypeId of currentClass.structs) {
            const nestedType = index.classesById.get(nestedTypeId)
            if (nestedType?.name === targetName) return nestedType
        }
        for (const nestedTypeId of currentClass.enums) {
            const nestedType = index.classesById.get(nestedTypeId)
            if (nestedType?.name === targetName) return nestedType
        }

        const parentAssociations = currentClass.getParentContracts()
        for (let i = parentAssociations.length - 1; i >= 0; i--) {
            stack.push({
                type: 'parent',
                source: currentClass,
                association: parentAssociations[i],
            })
        }
    }

    return undefined
}

import {
    DiGraph,
    Dijkstra,
    Edge,
    TopologicalSort,
    WeightedDiGraph,
} from 'js-graph-algorithms'
import { ClassStereotype, UmlClass } from '../umlClass'
import { findAssociatedClass } from './associations'
import { ClassOptions } from '../diagram/classToDot'

const debug = require('debug')('sol2uml-light')

/**
 * Filter out any UML Class types that are to be hidden.
 * @param umlClasses array of UML classes of type `UMLClass`
 * @param options sol2uml-light class options
 * @return umlClasses filtered list of UML classes of type `UMLClass`
 */
export const filterHiddenClasses = (
    umlClasses: readonly UmlClass[],
    options: ClassOptions,
): UmlClass[] => {
    return umlClasses.filter(
        (u) =>
            (u.stereotype === ClassStereotype.Enum && !options.hideEnums) ||
            (u.stereotype === ClassStereotype.Struct && !options.hideStructs) ||
            (u.stereotype === ClassStereotype.Abstract &&
                !options.hideAbstracts) ||
            (u.stereotype === ClassStereotype.Interface &&
                !options.hideInterfaces) ||
            (u.stereotype === ClassStereotype.Constant &&
                !options.hideConstants) ||
            (u.stereotype === ClassStereotype.Library &&
                !options.hideLibraries) ||
            ((u.stereotype === ClassStereotype.None ||
                u.stereotype === ClassStereotype.Contract) &&
                !options.hideContracts),
    )
}

/**
 * Finds all the UML classes that have an association with a list of base contract names.
 * The associated classes can be contracts, abstract contracts, interfaces, libraries, enums, structs or constants.
 * @param umlClasses array of UML classes of type `UMLClass`
 * @param baseContractNames array of base contract names
 * @param depth limit the number of associations from the base contract.
 * @return filteredUmlClasses list of UML classes of type `UMLClass`
 */
export const classesConnectedToBaseContracts = (
    umlClasses: readonly UmlClass[],
    baseContractNames: readonly string[],
    depth?: number,
): UmlClass[] => {
    let filteredUmlClasses: { [contractName: string]: UmlClass } = {}

    const weightedDirectedGraph = loadWeightedDirectedGraph(umlClasses)

    for (const baseContractName of baseContractNames) {
        filteredUmlClasses = {
            ...filteredUmlClasses,
            ...classesConnectedToBaseContract(
                umlClasses,
                baseContractName,
                weightedDirectedGraph,
                depth,
            ),
        }
    }

    return Object.values(filteredUmlClasses)
}

/**
 * Finds all the UML classes that have an association with a base contract name.
 * The associated classes can be contracts, abstract contracts, interfaces, libraries, enums, structs or constants.
 * @param umlClasses array of UML classes of type `UMLClass`
 * @param baseContractName base contract name
 * @param weightedDirectedGraph graph of type WeightedDiGraph from the `js-graph-algorithms` package
 * @param depth limit the number of associations from the base contract.
 * @return filteredUmlClasses list of UML classes of type `UMLClass`
 */
export const classesConnectedToBaseContract = (
    umlClasses: readonly UmlClass[],
    baseContractName: string,
    weightedDirectedGraph: WeightedDiGraph,
    depth: number = 1000,
): { [contractName: string]: UmlClass } => {
    // Find the base UML Class from the base contract name
    const baseUmlClass = umlClasses.find(({ name }) => {
        return name === baseContractName
    })

    if (!baseUmlClass) {
        throw Error(
            `Failed to find base contract with name "${baseContractName}"`,
        )
    }

    const dfs = new Dijkstra(weightedDirectedGraph, baseUmlClass.id)

    // Get all the UML Classes that are connected to the base contract
    const filteredUmlClasses: { [contractName: string]: UmlClass } = {}
    for (const umlClass of umlClasses) {
        if (dfs.distanceTo(umlClass.id) <= depth) {
            filteredUmlClasses[umlClass.name] = umlClass
        }
    }

    return filteredUmlClasses
}

function loadWeightedDirectedGraph(
    umlClasses: readonly UmlClass[],
): WeightedDiGraph {
    const weightedDirectedGraph = new WeightedDiGraph(
        // the number vertices in the graph
        UmlClass.idCounter + 1,
    )

    forEachResolvedAssociation(umlClasses, (source, target) => {
        debug(
            `Adding edge from ${source.name} with id ${source.id} to ${target.name} with id ${target.id} and type ${target.stereotype}`,
        )
        weightedDirectedGraph.addEdge(new Edge(source.id, target.id, 1))
    })

    return weightedDirectedGraph
}

export const topologicalSortClasses = (
    umlClasses: readonly UmlClass[],
): UmlClass[] => {
    const directedAcyclicGraph = loadDirectedAcyclicGraph(umlClasses)
    const topologicalSort = new TopologicalSort(directedAcyclicGraph)

    const sortedUmlClassIds = topologicalSort.order().reverse()
    const classById = new Map<number, UmlClass>()
    for (const umlClass of umlClasses) {
        if (!classById.has(umlClass.id)) {
            classById.set(umlClass.id, umlClass)
        }
    }
    const sortedUmlClasses = sortedUmlClassIds.map((umlClassId) =>
        classById.get(umlClassId),
    )

    // Filter out any unfound classes. This happens when diff sources the second contract.
    return sortedUmlClasses.filter((umlClass) => umlClass !== undefined)
}

const loadDirectedAcyclicGraph = (umlClasses: readonly UmlClass[]): DiGraph => {
    const directedAcyclicGraph = new DiGraph(UmlClass.idCounter) // the number vertices in the graph

    forEachResolvedAssociation(umlClasses, (source, target) => {
        directedAcyclicGraph.addEdge(source.id, target.id)
    })

    return directedAcyclicGraph
}

const forEachResolvedAssociation = (
    umlClasses: readonly UmlClass[],
    addEdge: (source: UmlClass, target: UmlClass) => void,
): void => {
    for (const sourceUmlClass of umlClasses) {
        for (const association of Object.values(sourceUmlClass.associations)) {
            const targetUmlClass = findAssociatedClass(
                association,
                sourceUmlClass,
                umlClasses,
            )
            if (targetUmlClass) {
                addEdge(sourceUmlClass, targetUmlClass)
            }
        }
    }
}

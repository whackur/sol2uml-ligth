import { ReferenceType } from './umlTypes.js'
import type {
    Association,
    ClassProperties,
    ClassStereotype,
    Constants,
    Import,
    Attribute,
    Operator,
} from './umlTypes.js'

export class UmlClass implements ClassProperties {
    static idCounter = 0

    id: number
    // Assigned from properties by Object.assign in the constructor
    name!: string
    absolutePath!: string
    relativePath!: string
    // Used for structs and enums
    parentId?: number
    imports: Import[] = []
    stereotype?: ClassStereotype

    constants: Constants[] = []
    attributes: Attribute[] = []
    operators: Operator[] = []

    enums: number[] = []
    structs: number[] = []
    associations: { [name: string]: Association } = {}
    // Tracks all member access function call names for cross-referencing with using...for libraries
    memberAccessCalls: Set<string> = new Set()

    constructor(properties: ClassProperties) {
        if (!properties || !properties.name) {
            throw TypeError(
                `Failed to instantiate UML Class with no name property`,
            )
        }

        Object.assign(this, properties)

        this.id = UmlClass.idCounter++
    }

    addAssociation(association: Association) {
        if (!association || !association.targetUmlClassName) {
            throw TypeError(
                `Failed to add association. targetUmlClassName was missing`,
            )
        }

        if (!this.associations[association.targetUmlClassName]) {
            this.associations[association.targetUmlClassName] = association
        } else {
            // If new attribute reference type is Storage
            if (association.referenceType === ReferenceType.Storage) {
                this.associations[
                    association.targetUmlClassName
                ].referenceType = ReferenceType.Storage
            }
            // Merge functionsCalled arrays with deduplication
            if (association.functionsCalled?.length) {
                const existing =
                    this.associations[association.targetUmlClassName]
                if (!existing.functionsCalled) {
                    existing.functionsCalled = [...association.functionsCalled]
                } else {
                    for (const fn of association.functionsCalled) {
                        if (!existing.functionsCalled.includes(fn)) {
                            existing.functionsCalled.push(fn)
                        }
                    }
                }
            }
        }
    }

    /** Returns immediate inheritance associations only. */
    getParentContracts(): Association[] {
        return Object.values(this.associations).filter(
            (association) => association.realization,
        )
    }
}

export enum Visibility {
    None,
    Public,
    External,
    Internal,
    Private,
}

export enum ClassStereotype {
    None,
    Library,
    Interface,
    Abstract,
    Contract,
    Struct,
    Enum,
    Constant,
    Import,
}

export enum OperatorStereotype {
    None,
    Modifier,
    Event,
    Payable,
    Fallback,
    Abstract,
}

export enum AttributeType {
    Elementary,
    UserDefined,
    Function,
    Array,
    Mapping,
}

export interface Import {
    absolutePath: string
    classNames: {
        className: string
        alias?: string | null
    }[]
}

export interface Attribute {
    visibility?: Visibility
    name: string
    // Enums do not have types
    type?: string
    attributeType?: AttributeType
    compiled?: boolean // true for constants and immutables
    // Used for squashed classes
    sourceContract?: string
}

export interface Parameter {
    // name is not required in return parameters or operator parameters
    name?: string | null
    type: string
}

/// Contract functions, modifiers, events are modelled as UML operators
export interface Operator extends Attribute {
    stereotype?: OperatorStereotype
    parameters?: Parameter[]
    returnParameters?: Parameter[]
    stateMutability?: string | null
    modifiers?: string[]
    // Used by squashed classes
    hash?: string
    inheritancePosition?: number
    sourceContract?: string
}

export enum ReferenceType {
    Memory,
    Storage,
}

export interface Association {
    referenceType: ReferenceType
    // For the contract that contains structs and enums
    parentUmlClassName?: string
    targetUmlClassName: string
    realization?: boolean
    functionsCalled?: string[]
}

export interface Constants {
    name: string
    value: number
    // Used for squashed classes
    sourceContract?: string
}

export interface ClassProperties {
    name: string
    absolutePath: string
    relativePath: string
    // Used for structs and enums
    parentId?: number
    importedFileNames?: string[]
    stereotype?: ClassStereotype
    enums?: number[]
    structs?: number[]
    attributes?: Attribute[]
    operators?: Operator[]
    associations?: { [name: string]: Association }
    constants?: Constants[]
}

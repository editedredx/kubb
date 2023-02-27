/* eslint-disable no-param-reassign */
import { factory } from 'typescript'
import { pascalCase, camelCase } from 'change-case'
import uniq from 'lodash.uniq'

import { SchemaGenerator } from '@kubb/core'
import type { Oas, OpenAPIV3 } from '@kubb/swagger'
import { isReference, getReference } from '@kubb/swagger'
import {
  appendJSDocToNode,
  createEnumDeclaration,
  createIndexSignature,
  createIntersectionDeclaration,
  createPropertySignature,
  createTypeAliasDeclaration,
  modifier,
} from '@kubb/ts-codegen'

import { keywordTypeNodes } from '../utils'

import type ts from 'typescript'

// based on https://github.com/cellular/oazapfts/blob/7ba226ebb15374e8483cc53e7532f1663179a22c/src/codegen/generate.ts#L398

/**
 * Name is the ref name + resolved with the nameResolver
 * Key is the original name used
 */
export type Refs = Record<string, { name: string; key: string }>

type Options = {
  withJSDocs?: boolean
  nameResolver?: (name: string) => string
}
export class TypeGenerator extends SchemaGenerator<Options, OpenAPIV3.SchemaObject, ts.Node[]> {
  // Collect the types of all referenced schemas so we can export them later
  refs: Refs = {}

  extraNodes: ts.Node[] = []

  aliases: ts.TypeAliasDeclaration[] = []

  // Keep track of already used type aliases
  typeAliases: Record<string, number> = {}

  constructor(public readonly oas: Oas, options: Options = { withJSDocs: true, nameResolver: (name) => name }) {
    super(options)

    return this
  }

  build(schema: OpenAPIV3.SchemaObject, name: string, description?: string) {
    const nodes: ts.Node[] = []
    const type = this.getTypeFromSchema(schema, name)

    const node = createTypeAliasDeclaration({
      modifiers: [modifier.export],
      name,
      type,
    })

    if (description) {
      nodes.push(
        appendJSDocToNode({
          node,
          comments: [`@description ${description}`],
        })
      )
    } else {
      nodes.push(node)
    }

    // filter out if the export name is the same as one that we already defined in extraNodes(see enum)
    const filterdNodes = nodes.filter(
      (node: ts.TypeAliasDeclaration) => !this.extraNodes.some((extraNode: ts.TypeAliasDeclaration) => extraNode?.name?.escapedText === node?.name?.escapedText)
    )

    return [...this.extraNodes, ...filterdNodes]
  }

  /**
   * Creates a type node from a given schema.
   * Delegates to getBaseTypeFromSchema internally and
   * optionally adds a union with null.
   */
  private getTypeFromSchema(schema: OpenAPIV3.SchemaObject, name?: string): ts.TypeNode {
    const type = this.getBaseTypeFromSchema(schema, name)
    if (schema) {
      return type
    }

    return factory.createUnionTypeNode([type, keywordTypeNodes.null])
  }

  /**
   * Recursively creates a type literal with the given props.
   */
  private getTypeFromProperties(baseSchema?: OpenAPIV3.SchemaObject, baseName?: string) {
    const props = baseSchema?.properties || {}
    const required = baseSchema?.required
    const additionalProperties = baseSchema?.additionalProperties

    const members: ts.TypeElement[] = Object.keys(props).map((name) => {
      const schema = props[name] as OpenAPIV3.SchemaObject

      const isRequired = required && required.includes(name)
      let type: ts.TypeNode
      if (schema.enum) {
        type = this.getTypeFromSchema(schema, pascalCase(`${baseName} ${name}`, { delimiter: '' }))
      } else {
        type = this.getTypeFromSchema(schema, name)
      }

      if (!isRequired) {
        type = factory.createUnionTypeNode([type, keywordTypeNodes.undefined])
      }
      const propertySignature = createPropertySignature({
        questionToken: !isRequired,
        name,
        type,
      })
      if (this.options.withJSDocs) {
        return appendJSDocToNode({
          node: propertySignature,
          comments: [
            schema.description && `@description ${schema.description}`,
            schema.type && `@type ${schema.type}${isRequired ? '' : ' | undefined'} ${schema.format || ''}`,
            schema.example && `@example ${schema.example}`,
          ],
        })
      }

      return propertySignature
    })
    if (additionalProperties) {
      const type = additionalProperties === true ? keywordTypeNodes.any : this.getTypeFromSchema(additionalProperties as OpenAPIV3.SchemaObject)

      members.push(createIndexSignature(type))
    }
    return factory.createTypeLiteralNode(members)
  }

  private resolve<T>(obj: T | OpenAPIV3.ReferenceObject) {
    if (!isReference(obj)) return obj
    const ref = obj.$ref
    if (!ref.startsWith('#/')) {
      throw new Error(`External refs are not supported (${ref}). Make sure to call SwaggerParser.bundle() first.`)
    }
    return getReference(this.oas.api, ref) as T
  }

  private getUniqueAlias(name: string) {
    let used = this.typeAliases[name] || 0
    if (used) {
      this.typeAliases[name] = ++used
      name += used
    }
    this.typeAliases[name] = 1
    return name
  }

  /**
   * Create a type alias for the schema referenced by the given ReferenceObject
   */
  private getRefAlias(obj: OpenAPIV3.ReferenceObject) {
    const { $ref } = obj
    let ref = this.refs[$ref]

    if (!ref) {
      const schema = this.resolve<OpenAPIV3.SchemaObject>(obj)
      const name = this.getUniqueAlias(pascalCase(schema.title || $ref.replace(/.+\//, ''), { delimiter: '' }))

      // eslint-disable-next-line no-multi-assign
      ref = this.refs[$ref] = {
        name: this.options.nameResolver?.(name) || name,
        key: name,
      }
    }

    return factory.createTypeReferenceNode(ref.name, undefined)
  }

  /**
   * This is the very core of the OpenAPI to TS conversion - it takes a
   * schema and returns the appropriate type.
   */
  private getBaseTypeFromSchema(schema: OpenAPIV3.SchemaObject | undefined, name?: string): ts.TypeNode {
    if (!schema) {
      return keywordTypeNodes.any
    }

    if (isReference(schema)) {
      return this.getRefAlias(schema)
    }

    if (schema.oneOf) {
      // union
      const schemaWithoutOneOf = { ...schema, oneOf: undefined }

      return createIntersectionDeclaration({
        nodes: [
          this.getBaseTypeFromSchema(schemaWithoutOneOf, name),
          factory.createParenthesizedType(
            factory.createUnionTypeNode(
              schema.oneOf.map((item: OpenAPIV3.ReferenceObject) => {
                return this.getRefAlias(item)
              })
            )
          ),
        ],
      })
    }

    if (schema.anyOf) {
      // TODO anyOf -> union
    }
    if (schema.allOf) {
      // intersection/add
      const schemaWithoutAllOf = { ...schema, allOf: undefined }

      return createIntersectionDeclaration({
        nodes: [
          this.getBaseTypeFromSchema(schemaWithoutAllOf, name),
          factory.createParenthesizedType(
            factory.createIntersectionTypeNode(
              schema.allOf.map((item: OpenAPIV3.ReferenceObject) => {
                return this.getRefAlias(item)
              })
            )
          ),
        ],
      })
    }

    if (schema.enum && name) {
      this.extraNodes.push(
        ...createEnumDeclaration({
          name: camelCase(name, { delimiter: '' }),
          typeName: pascalCase(name, { delimiter: '' }),
          enums: uniq(schema.enum),
        })
      )
      return factory.createTypeReferenceNode(pascalCase(name, { delimiter: '' }), undefined)
    }

    if ('items' in schema) {
      // items -> array
      return factory.createArrayTypeNode(this.getTypeFromSchema(schema.items as OpenAPIV3.SchemaObject, name))
    }

    if (schema.properties || schema.additionalProperties) {
      // properties -> literal type
      return this.getTypeFromProperties(schema, name)
    }

    if (schema.type) {
      // string, boolean, null, number
      if (schema.type in keywordTypeNodes) {
        return keywordTypeNodes[schema.type]
      }
    }

    if (schema.format === 'binary') {
      return factory.createTypeReferenceNode('Blob', [])
    }

    return keywordTypeNodes.any
  }
}
import { faker } from '@faker-js/faker'
import { createPet } from '../createPet'
import type {
  FindPetsByTags400,
  FindPetsByTagsHeaderParams,
  FindPetsByTagsQueryParams,
  FindPetsByTagsQueryResponse,
} from '../../models/ts/petController/FindPetsByTags'

/**
 * @description Invalid tag value
 */

export function createFindPetsByTags400(override?: Partial<FindPetsByTags400>): NonNullable<FindPetsByTags400> {
  return undefined
}

export function createFindPetsByTagsHeaderParams(override: Partial<FindPetsByTagsHeaderParams> = {}): NonNullable<FindPetsByTagsHeaderParams> {
  return {
    ...{ 'X-EXAMPLE': faker.helpers.arrayElement<any>([`ONE`, `TWO`, `THREE`]) },
    ...override,
  }
}

export function createFindPetsByTagsQueryParams(override: Partial<FindPetsByTagsQueryParams> = {}): NonNullable<FindPetsByTagsQueryParams> {
  return {
    ...{ 'tags': faker.helpers.arrayElements([faker.string.alpha()]) as any, 'page': faker.string.alpha(), 'pageSize': faker.string.alpha() },
    ...override,
  }
}
/**
 * @description successful operation
 */

export function createFindPetsByTagsQueryResponse(override: Partial<FindPetsByTagsQueryResponse> = []): NonNullable<FindPetsByTagsQueryResponse> {
  return [
    ...faker.helpers.arrayElements([createPet()]) as any,
    ...override,
  ]
}

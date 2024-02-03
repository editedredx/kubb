import { faker } from '@faker-js/faker'
import { createOrder } from '../createOrder'
import type { GetOrderById400, GetOrderById404, GetOrderByIdPathParams, GetOrderByIdQueryResponse } from '../../models/GetOrderById'

/**
 * @description Invalid ID supplied
 */

export function createGetOrderById400(override?: Partial<GetOrderById400>): NonNullable<GetOrderById400> {
  return undefined
}
/**
 * @description Order not found
 */

export function createGetOrderById404(override?: Partial<GetOrderById404>): NonNullable<GetOrderById404> {
  return undefined
}

export function createGetOrderByIdPathParams(override: Partial<GetOrderByIdPathParams> = {}): NonNullable<GetOrderByIdPathParams> {
  return {
    ...{ 'orderId': faker.number.float({}) },
    ...override,
  }
}
/**
 * @description successful operation
 */

export function createGetOrderByIdQueryResponse(override?: Partial<GetOrderByIdQueryResponse>): NonNullable<GetOrderByIdQueryResponse> {
  return createOrder(override)
}

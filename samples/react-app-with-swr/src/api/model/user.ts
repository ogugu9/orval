/**
 * Generated by orval v6.11.0 🍺
 * Do not edit manually.
 * OpenAPI Petstore
 * This is a sample server Petstore server. For this sample, you can use the api key `special-key` to test the authorization filters.
 * OpenAPI spec version: 1.0.0
 */

/**
 * A User who is purchasing from the pet store
 */
export interface User {
  id?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  phone?: string;
  /** User Status */
  userStatus?: number;
}

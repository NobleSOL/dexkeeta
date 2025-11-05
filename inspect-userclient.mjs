// Inspect UserClient to see what methods are available
import { UserClient as NamedUserClient } from '@keetanetwork/keetanet-client';
import * as KeetaSDK from '@keetanetwork/keetanet-client';

console.log('=== Named Import (import { UserClient }) ===');
const namedClient = NamedUserClient.fromNetwork('test', null);
console.log('Type:', typeof namedClient);
console.log('Constructor:', namedClient.constructor.name);
console.log('Has getAllBalances?', typeof namedClient.getAllBalances);
console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(namedClient)).filter(m => typeof namedClient[m] === 'function').slice(0, 20));

console.log('\n=== Namespace Import (KeetaSDK.UserClient) ===');
const namespaceClient = KeetaSDK.UserClient.fromNetwork('test', null);
console.log('Type:', typeof namespaceClient);
console.log('Constructor:', namespaceClient.constructor.name);
console.log('Has getAllBalances?', typeof namespaceClient.getAllBalances);
console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(namespaceClient)).filter(m => typeof namespaceClient[m] === 'function').slice(0, 20));

console.log('\n=== Are they the same? ===');
console.log('Same constructor?', namedClient.constructor === namespaceClient.constructor);
console.log('NamedUserClient === KeetaSDK.UserClient?', NamedUserClient === KeetaSDK.UserClient);

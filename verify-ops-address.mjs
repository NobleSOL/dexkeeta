// Verify OPS address with correct derivation
import { getOpsAccount } from './server/keeta-impl/utils/client.js';

const ops = getOpsAccount();
const opsAddress = ops.publicKeyString.get();

console.log('OPS Address:', opsAddress);
console.log('Expected:    keeta_aabzi2udkrjsc4kcw7ew3wzsbneu2q4bh7ubcj5gbx523k6sklvj2pl4ldlrmpy');
console.log('Match:', opsAddress === 'keeta_aabzi2udkrjsc4kcw7ew3wzsbneu2q4bh7ubcj5gbx523k6sklvj2pl4ldlrmpy' ? '✅' : '❌');

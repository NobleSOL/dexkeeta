// Check pool reserves directly
import { getBalances } from '../server/keeta-impl/utils/client.js';

const POOL_ADDRESS = 'keeta_arwmubo5gxl7vzz3rulmcqyts7webl73zakb5d6hsm2khf3b5xsbil5m3bpek';
const KTA_TOKEN = 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52';
const WAVE_TOKEN = 'keeta_ant6bsl2obpmreopln5e242s3ihxyzjepd6vbkeoz3b3o3pxjtlsx3saixkym';

async function checkReserves() {
  try {
    console.log('🔍 Checking reserves for pool:', POOL_ADDRESS);
    console.log('');

    const balances = await getBalances(POOL_ADDRESS);
    console.log('📊 Raw balances:', balances);
    console.log('');

    const ktaBalance = balances.find(b => b.token === KTA_TOKEN);
    const waveBalance = balances.find(b => b.token === WAVE_TOKEN);

    console.log('KTA balance:', ktaBalance ? ktaBalance.balance.toString() : '0');
    console.log('WAVE balance:', waveBalance ? waveBalance.balance.toString() : '0');
    console.log('');

    // Human readable (9 decimals)
    if (ktaBalance) {
      const ktaHuman = Number(ktaBalance.balance) / 1e9;
      console.log('KTA (human):', ktaHuman);
    }
    if (waveBalance) {
      const waveHuman = Number(waveBalance.balance) / 1e9;
      console.log('WAVE (human):', waveHuman);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkReserves();

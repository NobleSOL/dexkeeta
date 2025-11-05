// Test /api/pools endpoint
async function testPoolsAPI() {
  try {
    console.log('🔍 Testing /api/pools endpoint...');
    console.log('');

    const response = await fetch('http://localhost:8081/api/pools');
    const data = await response.json();

    console.log('📊 API Response:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');

    if (data.pools && data.pools.length > 0) {
      const pool = data.pools[0];
      console.log('First pool:');
      console.log('  poolAddress:', pool.poolAddress);
      console.log('  symbolA:', pool.symbolA);
      console.log('  symbolB:', pool.symbolB);
      console.log('  tokenA:', pool.tokenA);
      console.log('  tokenB:', pool.tokenB);
      console.log('  reserveA:', pool.reserveA);
      console.log('  reserveB:', pool.reserveB);
      console.log('  reserveAHuman:', pool.reserveAHuman);
      console.log('  reserveBHuman:', pool.reserveBHuman);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testPoolsAPI();

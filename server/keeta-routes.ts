// server/keeta-routes.ts
// Keeta DEX API routes - integrates with Keeta Network blockchain
import { Router } from 'express';

// Import route modules from keeta-impl
import swapRouter from './keeta-impl/routes/swap.js';
import liquidityRouter from './keeta-impl/routes/liquidity.js';
import poolsRouter from './keeta-impl/routes/pools.js';
import walletRouter from './keeta-impl/routes/wallet.js';
import transactionsRouter from './keeta-impl/routes/transactions.js';

const router = Router();

// Mount Keeta routes under /api prefix
router.use('/api/swap', swapRouter);
router.use('/api/liquidity', liquidityRouter);
router.use('/api/pools', poolsRouter);
router.use('/api/wallet', walletRouter);
router.use('/api/transactions', transactionsRouter);

export default router;

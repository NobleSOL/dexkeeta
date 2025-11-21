// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20, ISilverbackFactory, ISilverbackPair } from "./interfaces.sol";
import { SilverbackLibraryV0 } from "./SilverbackLibraryV0.sol";

interface IWETH9 is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

/// @title SilverbackUnifiedRouter
/// @notice Unified router for Silverback DEX with protocol fee collection and external swap forwarding
/// @dev Combines V2 AMM operations with aggregator forwarding and optimized WETH fee collection
contract SilverbackUnifiedRouterV0 {
    // ========== TYPES ==========
    struct SwapParams {
        address inToken;        // ERC20 or address(0) for native ETH
        address outToken;       // ERC20 or address(0) for native ETH
        uint256 amountIn;
        uint256 minAmountOut;
        address to;
        address target;         // external DEX/aggregator
        bytes   data;           // calldata for target
        uint256 deadline;
        bool    sweep;          // sweep outToken delta to `to`
    }

    struct PermitData {
        address token;
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // ========== STORAGE ==========
    address public immutable factory;
    address public immutable WETH;
    address public constant NATIVE = address(0);

    // Reentrancy guard
    uint256 private constant UNLOCKED = 1;
    uint256 private constant LOCKED = 2;
    uint256 private _lockStatus = UNLOCKED;

    // ========== EVENTS ==========
    event SwapForwarded(address indexed user, address inToken, address outToken, uint amountIn, address target);

    // ========== MODIFIERS ==========
    
    modifier ensure(uint deadline) {
        require(block.timestamp <= deadline, "EXPIRED");
        _;
    }

    modifier nonReentrant() {
        require(_lockStatus == UNLOCKED, "LOCKED");
        _lockStatus = LOCKED;
        _;
        _lockStatus = UNLOCKED;
    }

    // Receive ETH from WETH contract
    receive() external payable {
        require(msg.sender == WETH, "ONLY_WETH");
    }

    // ========== CONSTRUCTOR ==========
    constructor(address _factory, address _WETH) {
        require(_factory != address(0) && _WETH != address(0), "ZERO_ADDRESS");
        factory = _factory;
        WETH = _WETH;
    }

    // ========== INTERNAL UTILS ==========
    function _balanceOf(address token) internal view returns (uint256) {
        if (token == NATIVE) return address(this).balance;
        return IERC20(token).balanceOf(address(this));
    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }

    function _safeTransferFrom(address token, address from, address to, uint value) private {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }

    function _forceApprove(address token, address spender, uint value) private {
        (bool s1, bytes memory d1) = token.staticcall(
            abi.encodeWithSelector(IERC20.allowance.selector, address(this), spender)
        );
        if (s1 && d1.length >= 32 && abi.decode(d1, (uint)) > 0) {
            (bool s2, ) = token.call(
                abi.encodeWithSelector(IERC20.approve.selector, spender, 0)
            );
            require(s2, "APPROVE_RESET_FAILED");
        }
        (bool s3, ) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, value)
        );
        require(s3, "APPROVE_FAILED");
    }

    function _revertMsg(bytes memory ret) private pure returns (string memory) {
        if (ret.length < 68) return "TARGET_CALL_FAILED";
        assembly {
            ret := add(ret, 0x04)
        }
        return abi.decode(ret, (string));
    }

        // ========== EXTERNAL SWAP FORWARDING ==========
    /// @notice Forward swap to external aggregator with fee collection in WETH
    function swapAndForward(SwapParams calldata p, PermitData calldata permit)
        external
        payable
        nonReentrant
        ensure(p.deadline)
    {
        if (permit.token != address(0)) {
            IERC20Permit(permit.token).permit(
                msg.sender,
                address(this),
                permit.value,
                permit.deadline,
                permit.v,
                permit.r,
                permit.s
            );
        }
        _swapAndForward(p);
    }

    function swapAndForward(SwapParams calldata p) external payable nonReentrant ensure(p.deadline) {
        _swapAndForward(p);
    }

    function _swapAndForward(SwapParams calldata p) internal {
        require(p.amountIn > 0 && p.target != address(0), "INVALID_PARAMS");

        uint preOut = _balanceOf(p.outToken);

        // Handle native ETH input
        if (p.inToken == NATIVE) {
            require(msg.value >= p.amountIn, "INSUFFICIENT_ETH");

            // Collect fee in native ETH
            // Forward remaining ETH to target
            (bool ok, bytes memory ret) = p.target.call{value: p.amountIn}(p.data);
            require(ok, _revertMsg(ret));

            emit SwapForwarded(msg.sender, p.inToken, p.outToken, p.amountIn, p.target);
        }
        // Handle ERC20 input
        else {
            _safeTransferFrom(p.inToken, msg.sender, address(this), p.amountIn);

            // Collect fee in input token
            // Approve and forward to target
            _forceApprove(p.inToken, p.target, p.amountIn);
            (bool ok, bytes memory ret) = p.target.call(p.data);
            require(ok, _revertMsg(ret));

            emit SwapForwarded(msg.sender, p.inToken, p.outToken, p.amountIn, p.target);
        }

        // Sweep output tokens if requested
        if (p.sweep) {
            uint postOut = _balanceOf(p.outToken);
            uint gained = postOut > preOut ? postOut - preOut : 0;
            require(gained >= p.minAmountOut, "INSUFFICIENT_OUTPUT");

            if (gained > 0) {
                if (p.outToken == NATIVE) {
                    (bool s, ) = payable(p.to).call{value: gained}("");
                    require(s, "ETH_TRANSFER_FAILED");
                } else {
                    _safeTransfer(p.outToken, p.to, gained);
                }
            }
        }
    }

    // ========== SILVERBACK V2 AMM OPERATIONS ==========
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external nonReentrant ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        if (ISilverbackFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            ISilverbackFactory(factory).createPair(tokenA, tokenB);
        }
        (amountA, amountB) = _calculateLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );
        address pair = ISilverbackFactory(factory).getPair(tokenA, tokenB);
        _safeTransferFrom(tokenA, msg.sender, pair, amountA);
        _safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = ISilverbackPair(pair).mint(to);
    }

    function _calculateLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal view returns (uint amountA, uint amountB) {
        (uint reserveA, uint reserveB) = SilverbackLibraryV0.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = SilverbackLibraryV0.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "INSUFFICIENT_B");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = SilverbackLibraryV0.quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal >= amountAMin, "INSUFFICIENT_A");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable nonReentrant ensure(deadline) returns (uint amountToken, uint amountETH, uint liquidity) {
        // Create pair if it doesn't exist
        if (ISilverbackFactory(factory).getPair(token, WETH) == address(0)) {
            ISilverbackFactory(factory).createPair(token, WETH);
        }

        (amountToken, amountETH) = _calculateLiquidity(
            token,
            WETH,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );
        address pair = ISilverbackFactory(factory).getPair(token, WETH);
        _safeTransferFrom(token, msg.sender, pair, amountToken);
        IWETH9(WETH).deposit{value: amountETH}();
        _safeTransfer(WETH, pair, amountETH);
        liquidity = ISilverbackPair(pair).mint(to);
        // Refund excess ETH
        if (msg.value > amountETH) {
            (bool success, ) = msg.sender.call{value: msg.value - amountETH}("");
            require(success, "ETH_REFUND_FAILED");
        }
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external nonReentrant ensure(deadline) returns (uint amountA, uint amountB) {
        address pair = ISilverbackFactory(factory).getPair(tokenA, tokenB);
        _safeTransferFrom(pair, msg.sender, pair, liquidity);
        (uint amount0, uint amount1) = ISilverbackPair(pair).burn(to);
        (address token0, ) = SilverbackLibraryV0.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "INSUFFICIENT_A");
        require(amountB >= amountBMin, "INSUFFICIENT_B");
    }

    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external nonReentrant ensure(deadline) returns (uint amountToken, uint amountETH) {
        address pair = ISilverbackFactory(factory).getPair(token, WETH);
        _safeTransferFrom(pair, msg.sender, pair, liquidity);
        (uint amount0, uint amount1) = ISilverbackPair(pair).burn(address(this));
        (address token0, ) = SilverbackLibraryV0.sortTokens(token, WETH);
        (amountToken, amountETH) = token == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountToken >= amountTokenMin, "INSUFFICIENT_TOKEN");
        require(amountETH >= amountETHMin, "INSUFFICIENT_ETH");
        _safeTransfer(token, to, amountToken);
        IWETH9(WETH).withdraw(amountETH);
        (bool success, ) = to.call{value: amountETH}("");
        require(success, "ETH_TRANSFER_FAILED");
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external nonReentrant ensure(deadline) returns (uint[] memory amounts) {
        // Collect fee from user in input token
        _safeTransferFrom(path[0], msg.sender, address(this), amountIn);
        // Calculate amounts and execute swap
        amounts = SilverbackLibraryV0.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT");
        _safeTransfer(path[0], SilverbackLibraryV0.pairFor(factory, path[0], path[1]), amountIn);
        _swap(amounts, path, to);
    }

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable nonReentrant ensure(deadline) returns (uint[] memory amounts) {
        require(path[0] == WETH, "INVALID_PATH");

        // Wrap ETH to WETH (no fee collection)
        IWETH9(WETH).deposit{value: msg.value}();

        // Calculate amounts and execute swap
        amounts = SilverbackLibraryV0.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT");
        _safeTransfer(WETH, SilverbackLibraryV0.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external nonReentrant ensure(deadline) returns (uint[] memory amounts) {
        require(path[path.length - 1] == WETH, "INVALID_PATH");

        // Collect fee from user in input token
        _safeTransferFrom(path[0], msg.sender, address(this), amountIn);
        // Calculate amounts and execute swap
        amounts = SilverbackLibraryV0.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT");
        _safeTransfer(path[0], SilverbackLibraryV0.pairFor(factory, path[0], path[1]), amountIn);
        _swap(amounts, path, address(this));

        // Unwrap WETH and send ETH to user
        IWETH9(WETH).withdraw(amounts[amounts.length - 1]);
        (bool success, ) = payable(to).call{value: amounts[amounts.length - 1]}("");
        require(success, "ETH_TRANSFER_FAILED");
    }

    function _swap(uint[] memory amounts, address[] memory path, address _to) internal {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = SilverbackLibraryV0.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0
                ? (uint(0), amountOut)
                : (amountOut, uint(0));
            address to = i < path.length - 2
                ? SilverbackLibraryV0.pairFor(factory, output, path[i + 2])
                : _to;
            ISilverbackPair(SilverbackLibraryV0.pairFor(factory, input, output)).swap(
                amount0Out,
                amount1Out,
                to,
                new bytes(0)
            );
        }
    }
}

interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

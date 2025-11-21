// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20, ISilverbackFactory, ISilverbackPair } from "./interfaces.sol";
import { SilverbackLibrary } from "./SilverbackLibrary.sol";

interface IWETH9 is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

contract SilverbackRouter {
    address public immutable factory;
    address public immutable WETH;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, "EXPIRED");
        _;
    }

    constructor(address _factory, address _WETH) {
        factory = _factory;
        WETH = _WETH;
    }

    receive() external payable {
        require(msg.sender == WETH, "RECEIVE_NOT_WETH");
    }

    // --- ADD LIQUIDITY ---
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        if (ISilverbackFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            ISilverbackFactory(factory).createPair(tokenA, tokenB);
        }
        (amountA, amountB) = _calculateLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
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
        (uint reserveA, uint reserveB) = SilverbackLibrary.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = SilverbackLibrary.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "INSUFFICIENT_B");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = SilverbackLibrary.quote(amountBDesired, reserveB, reserveA);
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
    ) external payable ensure(deadline) returns (uint amountToken, uint amountETH, uint liquidity) {
        if (ISilverbackFactory(factory).getPair(token, WETH) == address(0)) {
            ISilverbackFactory(factory).createPair(token, WETH);
        }
        (amountToken, amountETH) = _calculateLiquidityETH(token, amountTokenDesired, msg.value, amountTokenMin, amountETHMin);
        address pair = ISilverbackFactory(factory).getPair(token, WETH);
        _safeTransferFrom(token, msg.sender, pair, amountToken);
        IWETH9(WETH).deposit{value: amountETH}();
        _safeTransfer(WETH, pair, amountETH);
        liquidity = ISilverbackPair(pair).mint(to);
        if (msg.value > amountETH) {
            payable(msg.sender).transfer(msg.value - amountETH);
        }
    }

    function _calculateLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountETHDesired,
        uint amountTokenMin,
        uint amountETHMin
    ) internal view returns (uint amountToken, uint amountETH) {
        (uint reserveToken, uint reserveETH) = SilverbackLibrary.getReserves(factory, token, WETH);
        if (reserveToken == 0 && reserveETH == 0) {
            (amountToken, amountETH) = (amountTokenDesired, amountETHDesired);
        } else {
            uint amountETHOptimal = SilverbackLibrary.quote(amountTokenDesired, reserveToken, reserveETH);
            if (amountETHOptimal <= amountETHDesired) {
                require(amountETHOptimal >= amountETHMin, "INSUFFICIENT_ETH");
                (amountToken, amountETH) = (amountTokenDesired, amountETHOptimal);
            } else {
                uint amountTokenOptimal = SilverbackLibrary.quote(amountETHDesired, reserveETH, reserveToken);
                require(amountTokenOptimal >= amountTokenMin, "INSUFFICIENT_TOKEN");
                (amountToken, amountETH) = (amountTokenOptimal, amountETHDesired);
            }
        }
    }

    // --- REMOVE LIQUIDITY ---
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint amountA, uint amountB) {
        address pair = ISilverbackFactory(factory).getPair(tokenA, tokenB);
        _safeTransferFrom(pair, msg.sender, pair, liquidity);
        (uint amount0, uint amount1) = ISilverbackPair(pair).burn(to);
        (address token0,) = SilverbackLibrary.sortTokens(tokenA, tokenB);
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
    ) external ensure(deadline) returns (uint amountToken, uint amountETH) {
        address pair = ISilverbackFactory(factory).getPair(token, WETH);
        _safeTransferFrom(pair, msg.sender, pair, liquidity);
        (uint amount0, uint amount1) = ISilverbackPair(pair).burn(address(this));
        (address token0,) = SilverbackLibrary.sortTokens(token, WETH);
        (amountToken, amountETH) = token == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountToken >= amountTokenMin, "INSUFFICIENT_TOKEN");
        require(amountETH >= amountETHMin, "INSUFFICIENT_ETH");
        _safeTransfer(token, to, amountToken);
        IWETH9(WETH).withdraw(amountETH);
        payable(to).transfer(amountETH);
    }

    // --- SWAPS ---
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint[] memory amounts) {
        amounts = SilverbackLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT");
        _safeTransferFrom(path[0], msg.sender, SilverbackLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable ensure(deadline) returns (uint[] memory amounts) {
        require(path[0] == WETH, "INVALID_PATH");
        amounts = SilverbackLibrary.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT");
        IWETH9(WETH).deposit{value: amounts[0]}();
        _safeTransfer(WETH, SilverbackLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint[] memory amounts) {
        require(path[path.length - 1] == WETH, "INVALID_PATH");
        amounts = SilverbackLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT");
        _safeTransferFrom(path[0], msg.sender, SilverbackLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, address(this));
        IWETH9(WETH).withdraw(amounts[amounts.length - 1]);
        payable(to).transfer(amounts[amounts.length - 1]);
    }

    function _swap(uint[] memory amounts, address[] memory path, address _to) internal {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0,) = SilverbackLibrary.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint256(0), amountOut) : (amountOut, uint256(0));
            address to = i < path.length - 2 ? SilverbackLibrary.pairFor(factory, output, path[i + 2]) : _to;
            ISilverbackPair(SilverbackLibrary.pairFor(factory, input, output)).swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FAILED");
    }

    function _safeTransferFrom(address token, address from, address to, uint value) private {
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), "TRANSFER_FROM_FAILED");
    }
}

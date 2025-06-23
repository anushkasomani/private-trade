// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable}          from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard}  from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IVerifier}        from "./IZKVerifier.sol";
import {IPerpCore}        from "./IPerpCore.sol"; // You must create this interface

/// @title  Private, ZK-secured Perps Engine
/// @notice Manages off-chain batched netting, on-chain funding, and ZK liquidations
contract PerpEngineZK is  ReentrancyGuard {
    /*───────────────────
        Data Structures
    ───────────────────*/

    struct Asset {
        bytes32 root;          // Poseidon Merkle root of trader leaves
        int256  lpNetQty;      // Virtual LP inventory (signed, 1e18)
        uint256 lpMargin;      // LP margin backing that inventory (USDC 1e6)
        uint256 cumFunding;    // Cumulative funding index (1e18)
        uint40  lastFundingTs; // Last funding update
    }

    /// Mapping asset-ID → state
    mapping(uint8 => Asset) public asset;

    /*───────────────────
          Constants
    ───────────────────*/

    IVerifier public immutable verifier;
    address   public immutable core;
    address public immutable owner;
    uint256 public constant MCR             = 62_5e16;  // 6.25 %
    uint256 public constant FUNDING_PERIOD  = 1 hours;
    uint256 public constant MAX_PREMIUM_X18 = 5e16;     // 5 % per hour cap

    /*───────────────────
          Events
    ───────────────────*/

    event RootUpdated   (uint8 indexed id, bytes32 newRoot);
    event NetTrade      (uint8 indexed id, int256 qty, int256 marginDelta);
    event Liquidate     (address indexed trader, uint8 indexed id, int256 size);
    event FundingSettled(uint8 indexed id, uint256 premium);

    /*───────────────────
       Constructor
    ───────────────────*/

    constructor(address _verifier, address _core) {
        owner=msg.sender;
        verifier = IVerifier(_verifier);
        core     = _core;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
        
    }

    /* ─────────────────────────────────────────────
       1)  Funding-rate keeper  (permission-less)
    ───────────────────────────────────────────── */

    function settleFunding(uint8 id, uint256 twapPremiumX18) external {
        require(twapPremiumX18 <= MAX_PREMIUM_X18, "premium too high");

        Asset storage a = asset[id];
        require(block.timestamp >= a.lastFundingTs + FUNDING_PERIOD, "too soon");

        a.cumFunding   += twapPremiumX18;
        a.lastFundingTs = uint40(block.timestamp);

        emit FundingSettled(id, twapPremiumX18);
    }

    /* ─────────────────────────────────────────────
       2)  Private liquidation via zk-SNARK
    ───────────────────────────────────────────── */

    /**
     * @notice Verifies a Groth16 proof that a trader’s margin < 0,
     *         accepts the new Merkle root, and emits Liquidate.
     */
    function verifyAndLiquidate(
        uint8   id,
        bytes32 oldRoot,
        bytes32 newRoot,
        address trader,
        int256  size,
        uint256 margin,
        uint256 entryFunding,
        bytes calldata proof
    ) external nonReentrant {
        Asset storage a = asset[id];
        require(a.root == oldRoot, "stale root");

        /* build public-inputs */
        uint256[6] memory pubInsFixed;
        pubInsFixed[0] = uint256(oldRoot);
        pubInsFixed[1] = uint256(newRoot);
        pubInsFixed[2] = size < 0 ? uint256(-size) : uint256(size);
        pubInsFixed[3] = margin;
        pubInsFixed[4] = entryFunding;
        pubInsFixed[5] = a.cumFunding;

        // Convert to dynamic array for verifier
        uint256[] memory pubIns = new uint256[](6);
        for (uint256 i = 0; i < 6; ++i) {
            pubIns[i] = pubInsFixed[i];
        }

        /* verify proof */
        require(verifier.verify(proof, pubIns), "invalid proof");

        /* accept updated root */
        a.root = newRoot;
        emit RootUpdated(id, newRoot);
        emit Liquidate(trader, id, size);
    }

    /* ─────────────────────────────────────────────
       3)  Net-exposure update  (Executor-only)
    ───────────────────────────────────────────── */

    /**
     * @dev `marginDelta` is signed: +ve when traders deposit margin,
     *      -ve when margin is withdrawn to LP side.
     */
    function tradeNet(
        uint8   id,
        int256  qty,
        int256  marginDelta
    ) external onlyOwner nonReentrant {
        Asset storage a = asset[id];

        a.lpNetQty += qty;

        if (marginDelta >= 0) {
            a.lpMargin += uint256(marginDelta);
        } else {
            a.lpMargin -= uint256(-marginDelta);
        }

        emit NetTrade(id, qty, marginDelta);

        // 🔁 Forward delta to core engine
        IPerpCore(core).applyNetDelta(id, qty, marginDelta);
    }
}

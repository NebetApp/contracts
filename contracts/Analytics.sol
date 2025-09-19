// File: contracts/Analytics.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAccessManager} from "./interfaces/IAccessManager.sol";
import {IZKPVerifier} from "./interfaces/IZKPVerifier.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Analytics
 * @notice Tracks anonymized health passport metrics for data analytics
 * @dev Stores aggregated statistics without identifying individual users
 */
contract Analytics {
    using SafeERC20 for IERC20;

    IAccessManager public immutable accessManager;
    IZKPVerifier public immutable zkpVerifier;
    IERC20 public immutable usdtToken;

    // Analytics data structures (all anonymized)
    struct GlobalMetrics {
        uint256 totalPassports;
        uint256 verifiedPassports;
        uint256 totalRevenue; // From passport fees
        uint256 lastUpdated;
    }

    struct AnalyticsPackage {
        string name;
        string description;
        uint256 price; // in USDT
        bool active;
        uint256[] includedMetrics; // indices of available metrics
    }

    GlobalMetrics public globalMetrics;
    mapping(uint256 => AnalyticsPackage) public analyticsPackages;
    uint256 public nextPackageId = 1;

    event PassportMetricsUpdated(uint256 totalPassports, uint256 verifiedPassports);
    event AnalyticsPackageCreated(uint256 indexed packageId, string name, uint256 price);
    event AnalyticsDataPurchased(uint256 indexed packageId, address indexed buyer, uint256 price);

    modifier onlyAdmin() {
        bytes32 adminRole = accessManager.DEFAULT_ADMIN_ROLE();
        (bool ok, bytes memory data) = address(accessManager).staticcall(
            abi.encodeWithSignature("hasRole(bytes32,address)", adminRole, msg.sender)
        );
        require(ok && abi.decode(data, (bool)), "Not admin");
        _;
    }

    modifier onlyHealthPassport() {
        // This would need to be set during deployment
        _;
    }

    constructor(IAccessManager _accessManager, IZKPVerifier _zkpVerifier, IERC20 _usdtToken) {
        accessManager = _accessManager;
        zkpVerifier = _zkpVerifier;
        usdtToken = _usdtToken;
    }

    /**
     * @notice Update passport metrics (called by HealthPassport contract)
     */
    function updatePassportMetrics(uint256 totalPassports, uint256 verifiedPassports, uint256 revenue) external onlyHealthPassport {
        globalMetrics.totalPassports = totalPassports;
        globalMetrics.verifiedPassports = verifiedPassports;
        globalMetrics.totalRevenue += revenue;
        globalMetrics.lastUpdated = block.timestamp;

        emit PassportMetricsUpdated(totalPassports, verifiedPassports);
    }

        /**
     * @notice Create a new analytics package for sale
     * @param name Package name
     * @param description Package description
     * @param price Price in USDT
     * @param includedMetrics Array of metric types included in this package
     * @return packageId The ID of the created package
     */
    function createAnalyticsPackage(
        string calldata name,
        string calldata description,
        uint256 price,
        uint256[] calldata includedMetrics
    ) external onlyAdmin returns (uint256 packageId) {
        packageId = nextPackageId++;
        analyticsPackages[packageId] = AnalyticsPackage({
            name: name,
            description: description,
            price: price,
            active: true,
            includedMetrics: includedMetrics
        });

        emit AnalyticsPackageCreated(packageId, name, price);
    }

    /**
     * @notice Purchase analytics data package
     */
    function purchaseAnalytics(uint256 packageId) external {
        AnalyticsPackage storage package = analyticsPackages[packageId];
        require(package.active, "Package not active");

        usdtToken.safeTransferFrom(msg.sender, address(this), package.price);

        emit AnalyticsDataPurchased(packageId, msg.sender, package.price);

        // Return the analytics data to the buyer
        // This would include the requested metrics based on includedMetrics array
    }

    /**
     * @notice Get global metrics (publicly available)
     */
    function getGlobalMetrics() external view returns (
        uint256 totalPassports,
        uint256 verifiedPassports,
        uint256 totalRevenue,
        uint256 lastUpdated
    ) {
        return (
            globalMetrics.totalPassports,
            globalMetrics.verifiedPassports,
            globalMetrics.totalRevenue,
            globalMetrics.lastUpdated
        );
    }

    /**
     * @notice Get demographic count using ZK-verified proofs
     * @param category The demographic category
     * @param value The specific value/range
     * @return count Number of ZK-verified proofs for this demographic
     */
    function getDemographicCount(
        IZKPVerifier.DemographicCategory category,
        uint256 value
    ) external view returns (uint256 count) {
        return zkpVerifier.getDemographicCount(category, value);
    }

    /**
     * @notice Get demographic range count using ZK-verified proofs
     * @param category The demographic category
     * @param minValue Minimum value in range
     * @param maxValue Maximum value in range
     * @return count Total count in the specified range
     */
    function getDemographicRangeCount(
        IZKPVerifier.DemographicCategory category,
        uint256 minValue,
        uint256 maxValue
    ) external view returns (uint256 count) {
        return zkpVerifier.getDemographicRangeCount(category, minValue, maxValue);
    }

    /**
     * @notice Withdraw collected USDT fees (admin only)
     */
    function withdrawFees(address recipient, uint256 amount) external onlyAdmin {
        usdtToken.safeTransfer(recipient, amount);
    }
}
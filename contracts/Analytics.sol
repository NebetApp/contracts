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
    address public healthPassport;

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
    mapping(bytes32 => uint256) private _verifiedDemographicCounts;

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
        require(msg.sender == healthPassport && healthPassport != address(0), "Not passport");
        _;
    }

    constructor(IAccessManager _accessManager, IZKPVerifier _zkpVerifier, IERC20 _usdtToken) {
        accessManager = _accessManager;
        zkpVerifier = _zkpVerifier;
        usdtToken = _usdtToken;
    }

    event HealthPassportSet(address indexed account);
    event VerifiedDemographicRecorded(uint8 indexed category, uint256 indexed value, uint256 amount);

    function setHealthPassport(address account) external {
        require(healthPassport == address(0), "Passport set");
        bytes32 adminRole = accessManager.DEFAULT_ADMIN_ROLE();
        (bool ok, bytes memory data) = address(accessManager).staticcall(
            abi.encodeWithSignature("hasRole(bytes32,address)", adminRole, msg.sender)
        );
        require(ok && abi.decode(data, (bool)), "Not admin");

        healthPassport = account;
        emit HealthPassportSet(account);
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

    function recordVerifiedDemographic(
        uint8 category,
        uint256 value,
        uint256 amount
    ) external onlyHealthPassport {
        bytes32 key = keccak256(abi.encodePacked(category, value));
        _verifiedDemographicCounts[key] += amount;
        emit VerifiedDemographicRecorded(category, value, amount);
    }

    function getVerifiedDemographicCount(
        uint8 category,
        uint256 value
    ) external view returns (uint256 count) {
        bytes32 key = keccak256(abi.encodePacked(category, value));
        return _verifiedDemographicCounts[key];
    }

    /**
     * @notice Bulk helper to retrieve a series of demographic counts
     */
    function getVerifiedDemographicBatch(
        uint8[] calldata categories,
        uint256[] calldata values
    ) external view returns (uint256[] memory counts) {
        require(categories.length == values.length, "Array length mismatch");
        counts = new uint256[](categories.length);
        for (uint256 i = 0; i < categories.length; i++) {
            bytes32 key = keccak256(abi.encodePacked(categories[i], values[i]));
            counts[i] = _verifiedDemographicCounts[key];
        }
    }

    /**
     * @notice Withdraw collected USDT fees (admin only)
     */
    function withdrawFees(address recipient, uint256 amount) external onlyAdmin {
        usdtToken.safeTransfer(recipient, amount);
    }
}

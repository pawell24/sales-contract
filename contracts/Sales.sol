// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SalesContract is Ownable {
    using SafeERC20 for IERC20;

    enum SaleStatus {
        Pending,
        Completed,
        Cancelled,
        Disputed
    }

    struct Sale {
        address buyer;
        address seller;
        uint256 amount;
        address tokenAddress;
        SaleStatus status;
        address arbiter;
    }

    mapping(uint256 => Sale) public sales;
    uint256 public saleCounter;

    event SaleCreated(
        uint256 saleId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        address tokenAddress
    );
    event SaleCompleted(uint256 saleId);
    event SaleCancelled(uint256 saleId);
    event DisputeResolved(uint256 saleId, address winner);
    event SaleDisputed(uint256 saleId);

    constructor() Ownable(msg.sender) {}

    modifier onlyBuyerOrSeller(uint256 saleId) {
        require(
            msg.sender == sales[saleId].buyer ||
                msg.sender == sales[saleId].seller,
            "Not authorized"
        );
        _;
    }

    modifier onlyArbiter(uint256 saleId) {
        require(msg.sender == sales[saleId].arbiter, "Not authorized arbiter");
        _;
    }

    function createSale(
        address _seller,
        uint256 _amount,
        address _tokenAddress
    ) external payable {
        require(_seller != msg.sender, "Seller and buyer cannot be the same");
        require(_amount > 0, "Amount must be greater than zero");

        saleCounter++;
        sales[saleCounter] = Sale({
            buyer: msg.sender,
            seller: _seller,
            amount: _amount,
            tokenAddress: _tokenAddress,
            status: SaleStatus.Pending,
            arbiter: address(0)
        });

        if (_tokenAddress == address(0)) {
            require(msg.value == _amount, "Incorrect ETH amount");
        } else {
            require(_tokenAddress != address(0), "Invalid token address");
            require(
                IERC20(_tokenAddress).allowance(msg.sender, address(this)) >=
                    _amount,
                "Insufficient allowance"
            );

            IERC20(_tokenAddress).safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            );
        }

        emit SaleCreated(
            saleCounter,
            msg.sender,
            _seller,
            _amount,
            _tokenAddress
        );
    }

    function completeSale(uint256 saleId) external onlyBuyerOrSeller(saleId) {
        Sale storage sale = sales[saleId];
        require(sale.status == SaleStatus.Pending, "Sale is not pending");

        sale.status = SaleStatus.Completed;

        if (sale.tokenAddress == address(0)) {
            payable(sale.seller).transfer(sale.amount);
        } else {
            IERC20(sale.tokenAddress).safeTransfer(sale.seller, sale.amount);
        }

        emit SaleCompleted(saleId);
    }

    function cancelSale(uint256 saleId) external onlyBuyerOrSeller(saleId) {
        Sale storage sale = sales[saleId];
        require(sale.status == SaleStatus.Pending, "Sale is not pending");

        sale.status = SaleStatus.Cancelled;

        if (sale.tokenAddress == address(0)) {
            payable(sale.buyer).transfer(sale.amount);
        } else {
            IERC20(sale.tokenAddress).safeTransfer(sale.buyer, sale.amount);
        }

        emit SaleCancelled(saleId);
    }

    function raiseDispute(
        uint256 saleId,
        address _arbiter
    ) external onlyBuyerOrSeller(saleId) {
        Sale storage sale = sales[saleId];
        require(sale.status == SaleStatus.Pending, "Sale is not pending");

        sale.arbiter = _arbiter;

        sale.status = SaleStatus.Disputed;

        emit SaleDisputed(saleId);
    }

    function resolveDispute(
        uint256 saleId,
        address winner
    ) external onlyArbiter(saleId) {
        Sale storage sale = sales[saleId];
        require(sale.status == SaleStatus.Disputed, "Sale is not disputed");
        require(
            winner == sale.buyer || winner == sale.seller,
            "Invalid winner"
        );

        sale.status = SaleStatus.Completed;

        if (sale.tokenAddress == address(0)) {
            payable(winner).transfer(sale.amount);
        } else {
            IERC20(sale.tokenAddress).safeTransfer(winner, sale.amount);
        }

        emit DisputeResolved(saleId, winner);
    }
}

# SalesContract

## Description

`SalesContract` is a smart contract for managing token sales. It allows for creating, completing, canceling, and resolving disputes regarding transactions.

## Functions

### `createSale(address _seller, uint256 _amount, address _tokenAddress)`

Creates a new sale. The user must be different from the seller, and the amount must be greater than zero.

### `completeSale(uint256 saleId)`

Completes the sale, transferring funds to the seller.

### `cancelSale(uint256 saleId)`

Cancels the sale and refunds the buyer.

### `raiseDispute(uint256 saleId, address _arbiter)`

Raises a dispute regarding the sale and sets the arbiter.

### `resolveDispute(uint256 saleId, address winner)`

Resolves the dispute, transferring funds to the winner.

## Events

- `SaleCreated`: Emitted when a sale is created.
- `SaleCompleted`: Emitted when a sale is completed.
- `SaleCancelled`: Emitted when a sale is canceled.
- `DisputeResolved`: Emitted when a dispute is resolved.
- `SaleDisputed`: Emitted when a dispute is raised.

## Compilation

To compile the contract, use the following command in the terminal:

```bash
npx hardhat compile
```

## Testing

To run the tests for the contract, use the following command in the terminal:

```bash
npm test
```

## Deploy

To deploy the contract, use the following command in the terminal:

```bash
npx hardhat ignition deploy ignition/modules/Sales.js --network localhost
```

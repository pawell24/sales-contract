const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sales", function () {
  let saleContract;
  let owner, buyer, seller, arbiter;
  const amount = ethers.parseEther("1");
  const tokenAddress = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    [owner, buyer, seller, arbiter] = await ethers.getSigners();
    const SaleContract = await ethers.getContractFactory("SalesContract");
    saleContract = await SaleContract.deploy();
  });

  describe("Sale Creation", function () {
    it("Should create a sale", async function () {
      await expect(
        saleContract
          .connect(buyer)
          .createSale(seller.address, amount, tokenAddress, {
            value: amount,
          })
      )
        .to.emit(saleContract, "SaleCreated")
        .withArgs(1, buyer.address, seller.address, amount, tokenAddress);
    });

    it("Should revert if buyer and seller are the same", async function () {
      await expect(
        saleContract
          .connect(buyer)
          .createSale(buyer.address, amount, tokenAddress, {
            value: amount,
          })
      ).to.be.revertedWith("Seller and buyer cannot be the same");
    });
  });

  describe("Completing Sales", function () {
    beforeEach(async function () {
      await saleContract
        .connect(buyer)
        .createSale(seller.address, amount, tokenAddress, {
          value: amount,
        });
    });

    it("Should complete a sale and check balances", async function () {
      const initialBuyerBalance = await ethers.provider.getBalance(
        buyer.address
      );
      const initialSellerBalance = await ethers.provider.getBalance(
        seller.address
      );

      await expect(saleContract.connect(buyer).completeSale(1))
        .to.emit(saleContract, "SaleCompleted")
        .withArgs(1);

      const finalBuyerBalance = await ethers.provider.getBalance(buyer.address);
      const finalSellerBalance = await ethers.provider.getBalance(
        seller.address
      );

      expect(finalSellerBalance).to.be.above(initialSellerBalance);
      expect(finalBuyerBalance).to.be.below(initialBuyerBalance);
    });

    it("Should revert if sale is not pending", async function () {
      await saleContract.connect(buyer).completeSale(1);
      await expect(
        saleContract.connect(buyer).completeSale(1)
      ).to.be.revertedWith("Sale is not pending");
    });
  });

  describe("Cancelling Sales", function () {
    beforeEach(async function () {
      await saleContract
        .connect(buyer)
        .createSale(seller.address, amount, tokenAddress, {
          value: amount,
        });
    });

    it("Should cancel a sale", async function () {
      await expect(saleContract.connect(buyer).cancelSale(1))
        .to.emit(saleContract, "SaleCancelled")
        .withArgs(1);
    });

    it("Should revert if sale is not pending", async function () {
      await saleContract.connect(buyer).cancelSale(1);
      await expect(
        saleContract.connect(buyer).cancelSale(1)
      ).to.be.revertedWith("Sale is not pending");
    });
  });

  describe("Dispute Resolution", function () {
    beforeEach(async function () {
      await saleContract
        .connect(buyer)
        .createSale(seller.address, amount, tokenAddress, {
          value: amount,
        });
    });

    it("Should raise a dispute", async function () {
      await expect(
        saleContract.connect(seller).raiseDispute(1, arbiter.address)
      )
        .to.emit(saleContract, "SaleDisputed")
        .withArgs(1);
    });

    it("Should resolve a dispute", async function () {
      await saleContract.connect(seller).raiseDispute(1, arbiter.address);
      await expect(
        saleContract.connect(arbiter).resolveDispute(1, buyer.address)
      )
        .to.emit(saleContract, "DisputeResolved")
        .withArgs(1, buyer.address);
    });

    it("Should revert if winner is not buyer or seller", async function () {
      await saleContract.connect(seller).raiseDispute(1, arbiter.address);
      await expect(
        saleContract.connect(arbiter).resolveDispute(1, arbiter.address)
      ).to.be.revertedWith("Invalid winner");
    });
  });

  describe("Arbiter Functionality", function () {
    beforeEach(async function () {
      await saleContract
        .connect(seller)
        .createSale(buyer.address, amount, tokenAddress, {
          value: amount,
        });
    });

    it("Shouldn't allow arbiter to raise a dispute", async function () {
      await expect(
        saleContract.raiseDispute(1, arbiter.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should revert if non-buyer or non-seller tries to raise a dispute", async function () {
      await expect(
        saleContract.connect(arbiter).raiseDispute(1, arbiter.address)
      ).to.be.revertedWith("Not authorized");
    });

    it("Should allow arbiter to resolve a dispute", async function () {
      await saleContract.connect(seller).raiseDispute(1, arbiter.address);
      await expect(
        saleContract.connect(arbiter).resolveDispute(1, buyer.address)
      )
        .to.emit(saleContract, "DisputeResolved")
        .withArgs(1, buyer.address);
    });

    it("Should revert if non-arbiter tries to resolve a dispute", async function () {
      await saleContract.connect(seller).raiseDispute(1, arbiter.address);
      await expect(
        saleContract.connect(seller).resolveDispute(1, buyer.address)
      ).to.be.revertedWith("Not authorized arbiter");
    });
  });

  describe("ERC20 Token Sales", function () {
    let ERC20MockContract;
    let token;
    const tokenAmount = ethers.parseUnits("10", 18);

    beforeEach(async function () {
      ERC20MockContract = await ethers.getContractFactory("ERC20Mock");
      token = await ERC20MockContract.deploy("TEST TOKEN", "TST");

      await token.transfer(buyer, tokenAmount);
      await token.connect(buyer).approve(saleContract.target, tokenAmount);
    });

    it("Should create a sale with ERC20 tokens", async function () {
      await expect(
        saleContract
          .connect(buyer)
          .createSale(seller.address, tokenAmount, token.target)
      )
        .to.emit(saleContract, "SaleCreated")
        .withArgs(1, buyer.address, seller.address, tokenAmount, token.target);
    });

    it("Should revert if token is not approved", async function () {
      await token.connect(owner).approve(saleContract.target, 0);
      await expect(
        saleContract
          .connect(owner)
          .createSale(seller.address, tokenAmount, token.target)
      ).to.be.revertedWith("Insufficient allowance");
    });

    it("Should allow buyer to purchase ERC20 tokens", async function () {
      await saleContract
        .connect(buyer)
        .createSale(seller.address, tokenAmount, token.target);
      await expect(saleContract.connect(buyer).completeSale(1))
        .to.emit(saleContract, "SaleCompleted")
        .withArgs(1);
    });

    it("should allow the buyer to cancel a pending sale and transfer ERC20 tokens", async () => {
      saleContract
        .connect(buyer)
        .createSale(seller.address, tokenAmount, token.target);
      await saleContract.connect(buyer).cancelSale(1);

      const sale = await saleContract.sales(1);
      expect(sale.status).to.equal(2);

      const buyerBalance = await token.balanceOf(buyer.address);
      expect(buyerBalance.toString()).to.equal(tokenAmount.toString());
    });

    it("Should allow arbiter to resolve a dispute", async function () {
      saleContract
        .connect(buyer)
        .createSale(seller.address, tokenAmount, token.target);

      await saleContract.connect(seller).raiseDispute(1, arbiter.address);

      await expect(
        saleContract.connect(arbiter).resolveDispute(1, buyer.address)
      )
        .to.emit(saleContract, "DisputeResolved")
        .withArgs(1, buyer.address);

      const sale = await saleContract.sales(1);
      expect(sale.status).to.equal(1);

      const buyerTokenBalance = await token.balanceOf(buyer.address);
      expect(buyerTokenBalance.toString()).to.equal(tokenAmount.toString());
    });
  });
});

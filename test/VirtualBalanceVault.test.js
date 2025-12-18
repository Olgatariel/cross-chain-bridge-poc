const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VirtualBalanceVault", function () {
  let vault;
  let owner, user1, user2, relayer, newRelayer;

  beforeEach(async function () {
    [owner, user1, user2, relayer, newRelayer] = await ethers.getSigners();

    const Vault = await ethers.getContractFactory("VirtualBalanceVault");
    vault = await Vault.deploy(relayer.address);
    await vault.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set relayer correctly", async function () {
      expect(await vault.relayer()).to.equal(relayer.address);
    });
  });

  describe("Credit", function () {
    it("Should allow relayer to credit balance", async function () {
      const amount = ethers.parseEther("100");

      await vault.connect(relayer).credit(user1.address, amount);

      expect(await vault.getBalance(user1.address)).to.equal(amount);
    });

    it("Should revert if called by non-relayer", async function () {
      await expect(
        vault.connect(user1).credit(user2.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(vault, "NotRelayer");
    });

    it("Should revert if amount is 0", async function () {
      await expect(
        vault.connect(relayer).credit(user1.address, 0)
      ).to.be.revertedWithCustomError(vault, "ZeroAmount");
    });

    it("Should revert if user address is 0", async function () {
      await expect(
        vault.connect(relayer).credit(ethers.ZeroAddress, 100)
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
  });

  describe("Spend", function () {
    const amount = ethers.parseEther("100");

    beforeEach(async function () {
      await vault.connect(relayer).credit(user1.address, amount);
    });

    it("Should allow user to spend balance", async function () {
      await vault.connect(user1).spend(ethers.parseEther("40"));

      expect(await vault.getBalance(user1.address)).to.equal(
        ethers.parseEther("60")
      );
    });

    it("Should revert if spend more than balance", async function () {
      await expect(
        vault.connect(user1).spend(ethers.parseEther("200"))
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("Should revert if spend 0", async function () {
      await expect(vault.connect(user1).spend(0)).to.be.revertedWithCustomError(
        vault,
        "ZeroAmount"
      );
    });
  });

  describe("Relayer update", function () {
    it("Should allow current relayer to update relayer", async function () {
      await vault.connect(relayer).updateRelayer(newRelayer.address);
      expect(await vault.relayer()).to.equal(newRelayer.address);
    });

    it("Should revert if non-relayer tries to update", async function () {
      await expect(
        vault.connect(user1).updateRelayer(newRelayer.address)
      ).to.be.revertedWithCustomError(vault, "NotRelayer");
    });

    it("Should revert if new relayer is 0 address", async function () {
      await expect(
        vault.connect(relayer).updateRelayer(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });
  });
});
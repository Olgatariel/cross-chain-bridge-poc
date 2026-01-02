const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BridgeMintBurn", function () {
    let wrappedToken;
    let bridge;
    let owner;
    let relayer;
    let user1;
    let user2;

    const BRIDGE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_ROLE"));

    beforeEach(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();
        
        // Deploy WrappedToken1
        const WrappedToken1 = await ethers.getContractFactory("WrappedToken1");
        wrappedToken = await WrappedToken1.deploy("Wrapped Token1", "wTKN1");
        
        // Deploy BridgeMintBurn
        const BridgeMintBurn = await ethers.getContractFactory("BridgeMintBurn");
        bridge = await BridgeMintBurn.deploy(wrappedToken.target, owner.address);
        
        // Grant BRIDGE_ROLE to the bridge contract on the wrapped token
        await wrappedToken.grantRole(BRIDGE_ROLE, bridge.target);
        
        // Grant BRIDGE_ROLE to relayer for bridge operations
        await bridge.grantRole(BRIDGE_ROLE, relayer.address);
    });

    describe("Deployment", function () {
        it("Should set the correct wrapped token address", async function () {
            expect(await bridge.wrappedToken()).to.equal(wrappedToken.target);
        });

        it("Should grant roles to admin", async function () {
            const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
            expect(await bridge.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await bridge.hasRole(BRIDGE_ROLE, owner.address)).to.be.true;
        });

        it("Should initialize nonces to zero", async function () {
            expect(await bridge.withdrawRequestNonce()).to.equal(0);
            expect(await bridge.withdrawNonce()).to.equal(0);
        });

        it("Should revert if token address is zero", async function () {
            const BridgeMintBurn = await ethers.getContractFactory("BridgeMintBurn");
            await expect(
                BridgeMintBurn.deploy(ethers.ZeroAddress, owner.address)
            ).to.be.revertedWith("Zero token address");
        });

        it("Should revert if admin address is zero", async function () {
            const BridgeMintBurn = await ethers.getContractFactory("BridgeMintBurn");
            await expect(
                BridgeMintBurn.deploy(wrappedToken.target, ethers.ZeroAddress)
            ).to.be.revertedWith("Zero admin");
        });
    });

    describe("Mint Wrapped", function () {
        const mintAmount = ethers.parseEther("1000");
        const depositNonce = 1;

        it("Should mint wrapped tokens to user", async function () {
            await bridge.connect(relayer).mintWrapped(user1.address, mintAmount, depositNonce);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(mintAmount);
        });

        it("Should mark deposit as processed", async function () {
            await bridge.connect(relayer).mintWrapped(user1.address, mintAmount, depositNonce);
            
            expect(await bridge.processedDeposits(depositNonce)).to.be.true;
        });

        it("Should emit WrappedMinted event", async function () {
            await expect(
                bridge.connect(relayer).mintWrapped(user1.address, mintAmount, depositNonce)
            )
                .to.emit(bridge, "WrappedMinted")
                .withArgs(user1.address, mintAmount, depositNonce);
        });

        it("Should not allow non-bridge role to mint", async function () {
            await expect(
                bridge.connect(user1).mintWrapped(user2.address, mintAmount, depositNonce)
            ).to.be.reverted;
        });

        it("Should revert if address is zero", async function () {
            await expect(
                bridge.connect(relayer).mintWrapped(ethers.ZeroAddress, mintAmount, depositNonce)
            ).to.be.revertedWith("Zero address");
        });

        it("Should revert if amount is zero", async function () {
            await expect(
                bridge.connect(relayer).mintWrapped(user1.address, 0, depositNonce)
            ).to.be.revertedWith("Zero amount");
        });

        it("Should revert if deposit already processed", async function () {
            await bridge.connect(relayer).mintWrapped(user1.address, mintAmount, depositNonce);
            
            await expect(
                bridge.connect(relayer).mintWrapped(user1.address, mintAmount, depositNonce)
            ).to.be.revertedWith("Deposit already processed");
        });

        it("Should handle multiple deposits with different nonces", async function () {
            await bridge.connect(relayer).mintWrapped(user1.address, mintAmount, 1);
            await bridge.connect(relayer).mintWrapped(user2.address, mintAmount, 2);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(mintAmount);
            expect(await wrappedToken.balanceOf(user2.address)).to.equal(mintAmount);
        });

        it("Should process deposits in any order", async function () {
            await bridge.connect(relayer).mintWrapped(user1.address, mintAmount, 10);
            await bridge.connect(relayer).mintWrapped(user1.address, mintAmount, 2);
            await bridge.connect(relayer).mintWrapped(user1.address, mintAmount, 5);
            
            expect(await bridge.processedDeposits(10)).to.be.true;
            expect(await bridge.processedDeposits(2)).to.be.true;
            expect(await bridge.processedDeposits(5)).to.be.true;
        });
    });

    describe("Request Withdraw", function () {
        const mintAmount = ethers.parseEther("1000");
        const withdrawAmount = ethers.parseEther("500");

        beforeEach(async function () {
            // First mint some tokens to user1
            await bridge.connect(relayer).mintWrapped(user1.address, mintAmount, 1);
        });

        it("Should burn tokens immediately", async function () {
            await bridge.connect(user1).requestWithdraw(withdrawAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(
                mintAmount - withdrawAmount
            );
        });

        it("Should emit WithdrawIntent event", async function () {
            await expect(bridge.connect(user1).requestWithdraw(withdrawAmount))
                .to.emit(bridge, "WithdrawIntent")
                .withArgs(user1.address, withdrawAmount, 0); // First withdraw gets nonce 0
        });

        it("Should increment withdrawNonce", async function () {
            expect(await bridge.withdrawNonce()).to.equal(0);
            
            await bridge.connect(user1).requestWithdraw(withdrawAmount);
            
            expect(await bridge.withdrawNonce()).to.equal(1);
        });

        it("Should revert if amount is zero", async function () {
            await expect(
                bridge.connect(user1).requestWithdraw(0)
            ).to.be.revertedWith("Zero amount");
        });

        it("Should revert if user has insufficient balance", async function () {
            const tooMuch = ethers.parseEther("2000");
            
            await expect(
                bridge.connect(user1).requestWithdraw(tooMuch)
            ).to.be.reverted; // ERC20: burn amount exceeds balance
        });

        it("Should allow multiple withdrawals", async function () {
            await bridge.connect(user1).requestWithdraw(withdrawAmount);
            await bridge.connect(user1).requestWithdraw(withdrawAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
            expect(await bridge.withdrawNonce()).to.equal(2);
        });

        it("Should allow different users to request withdrawals", async function () {
            // Mint to user2
            await bridge.connect(relayer).mintWrapped(user2.address, mintAmount, 2);
            
            await bridge.connect(user1).requestWithdraw(withdrawAmount);
            await bridge.connect(user2).requestWithdraw(withdrawAmount);
            
            expect(await bridge.withdrawNonce()).to.equal(2);
        });

        it("Should decrease total supply when tokens are burned", async function () {
            const initialSupply = await wrappedToken.totalSupply();
            
            await bridge.connect(user1).requestWithdraw(withdrawAmount);
            
            expect(await wrappedToken.totalSupply()).to.equal(initialSupply - withdrawAmount);
        });

        it("Should allow user to withdraw all tokens", async function () {
            await bridge.connect(user1).requestWithdraw(mintAmount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
        });
    });

    describe("Complete Bridge Flow", function () {
        const amount = ethers.parseEther("1000");

        it("Should handle deposit -> mint flow", async function () {
            // Simulate: User deposits on Base (nonce 1)
            // Relayer mints on Polygon
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(amount);
            expect(await bridge.processedDeposits(1)).to.be.true;
        });

        it("Should handle withdraw request flow", async function () {
            // First, mint some tokens
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            // User requests withdrawal (tokens are burned immediately)
            await bridge.connect(user1).requestWithdraw(amount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
            expect(await bridge.withdrawNonce()).to.equal(1);
        });

        it("Should handle multiple round trips", async function () {
            // Round trip 1: Base -> Polygon
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            // Round trip 1: Polygon -> Base
            await bridge.connect(user1).requestWithdraw(amount);
            
            // Round trip 2: Base -> Polygon
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 2);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(amount);
        });

        it("Should handle concurrent operations from multiple users", async function () {
            // User1 deposits from Base
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            // User2 deposits from Base
            await bridge.connect(relayer).mintWrapped(user2.address, amount, 2);
            
            // User1 withdraws back to Base
            await bridge.connect(user1).requestWithdraw(amount);
            
            // User2 still has tokens
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
            expect(await wrappedToken.balanceOf(user2.address)).to.equal(amount);
        });
    });

    describe("Edge Cases and Security", function () {
        const amount = ethers.parseEther("1000");

        it("Should prevent replay attacks on deposits", async function () {
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            await expect(
                bridge.connect(relayer).mintWrapped(user1.address, amount, 1)
            ).to.be.revertedWith("Deposit already processed");
        });

        it("Should handle very large amounts", async function () {
            const largeAmount = ethers.parseEther("1000000000"); // 1 billion tokens
            
            await bridge.connect(relayer).mintWrapped(user1.address, largeAmount, 1);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(largeAmount);
        });

        it("Should prevent user from withdrawing more than balance", async function () {
            // Mint tokens to user
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            // User transfers half to someone else
            await wrappedToken.connect(user1).transfer(user2.address, amount / 2n);
            
            // Now withdrawing full amount should fail
            await expect(
                bridge.connect(user1).requestWithdraw(amount)
            ).to.be.reverted; // ERC20: burn amount exceeds balance
            
            // But withdrawing remaining balance should work
            await bridge.connect(user1).requestWithdraw(amount / 2n);
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(0);
        });

        it("Should allow multiple bridge operators", async function () {
            const operator2 = user2;
            await bridge.grantRole(BRIDGE_ROLE, operator2.address);
            
            // Both operators can mint
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 1);
            await bridge.connect(operator2).mintWrapped(user1.address, amount, 2);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(amount * 2n);
        });

        it("Should handle role revocation", async function () {
            await bridge.revokeRole(BRIDGE_ROLE, relayer.address);
            
            await expect(
                bridge.connect(relayer).mintWrapped(user1.address, amount, 1)
            ).to.be.reverted;
        });

        it("Should atomically burn tokens on withdrawal request", async function () {
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            const balanceBefore = await wrappedToken.balanceOf(user1.address);
            const supplyBefore = await wrappedToken.totalSupply();
            
            // Withdraw should burn tokens immediately
            await bridge.connect(user1).requestWithdraw(amount);
            
            expect(await wrappedToken.balanceOf(user1.address)).to.equal(balanceBefore - amount);
            expect(await wrappedToken.totalSupply()).to.equal(supplyBefore - amount);
        });
    });

    describe("Nonce Management", function () {
        it("Should maintain separate nonce spaces for deposits and withdrawals", async function () {
            const amount = ethers.parseEther("100");
            
            // Mint with depositNonce 1
            await bridge.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            // Request withdrawal (withdrawNonce starts at 0)
            await bridge.connect(user1).requestWithdraw(amount);
            
            // Both nonce 1 should be usable in different contexts
            expect(await bridge.processedDeposits(1)).to.be.true;
            expect(await bridge.withdrawNonce()).to.equal(1);
        });

        it("Should increment withdrawNonce for each withdrawal", async function () {
            const amount = ethers.parseEther("100");
            
            // Mint tokens to both users
            await bridge.connect(relayer).mintWrapped(user1.address, amount * 3n, 1);
            
            expect(await bridge.withdrawNonce()).to.equal(0);
            
            await bridge.connect(user1).requestWithdraw(amount);
            expect(await bridge.withdrawNonce()).to.equal(1);
            
            await bridge.connect(user1).requestWithdraw(amount);
            expect(await bridge.withdrawNonce()).to.equal(2);
            
            await bridge.connect(user1).requestWithdraw(amount);
            expect(await bridge.withdrawNonce()).to.equal(3);
        });
    });
});
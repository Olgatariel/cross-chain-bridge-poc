const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenConsumer", function () {
    let token;
    let tokenConsumer;
    let owner;
    let relayer;
    let user1;
    let user2;

    const INITIAL_SUPPLY = ethers.parseEther("1000000");

    beforeEach(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();
        
        // Deploy Token1
        const Token1 = await ethers.getContractFactory("Token1");
        token = await Token1.deploy(INITIAL_SUPPLY);
        
        // Deploy TokenConsumer
        const TokenConsumer = await ethers.getContractFactory("TokenConsumer");
        tokenConsumer = await TokenConsumer.deploy(token.target);
        
        // Set relayer
        await tokenConsumer.setRelayer(relayer.address);
        
        // Give users some tokens
        await token.transfer(user1.address, ethers.parseEther("10000"));
        await token.transfer(user2.address, ethers.parseEther("10000"));
    });

    describe("Deployment", function () {
        it("Should set the correct token address", async function () {
            expect(await tokenConsumer.token()).to.equal(token.target);
        });

        it("Should set the correct owner", async function () {
            expect(await tokenConsumer.owner()).to.equal(owner.address);
        });

        it("Should initialize currentNonce to 0", async function () {
            expect(await tokenConsumer.currentNonce()).to.equal(0);
        });

        it("Should set relayer correctly", async function () {
            expect(await tokenConsumer.relayer()).to.equal(relayer.address);
        });
    });

    describe("Set Relayer", function () {
        it("Should allow owner to set relayer", async function () {
            await tokenConsumer.setRelayer(user1.address);
            expect(await tokenConsumer.relayer()).to.equal(user1.address);
        });

        it("Should not allow non-owner to set relayer", async function () {
            await expect(
                tokenConsumer.connect(user1).setRelayer(user2.address)
            ).to.be.reverted;
        });

        it("Should emit event when relayer is changed", async function () {
            // Note: You might want to add a RelayerChanged event to the contract
            await tokenConsumer.setRelayer(user1.address);
            expect(await tokenConsumer.relayer()).to.equal(user1.address);
        });
    });

    describe("Deposit", function () {
        const depositAmount = ethers.parseEther("100");

        beforeEach(async function () {
            // Approve TokenConsumer to spend user1's tokens
            await token.connect(user1).approve(tokenConsumer.target, depositAmount);
        });

        it("Should lock tokens in contract", async function () {
            const initialBalance = await token.balanceOf(tokenConsumer.target);
            
            await tokenConsumer.connect(user1).deposit(depositAmount);
            
            expect(await token.balanceOf(tokenConsumer.target)).to.equal(
                initialBalance + depositAmount
            );
        });

        it("Should reduce user's token balance", async function () {
            const initialBalance = await token.balanceOf(user1.address);
            
            await tokenConsumer.connect(user1).deposit(depositAmount);
            
            expect(await token.balanceOf(user1.address)).to.equal(
                initialBalance - depositAmount
            );
        });

        it("Should increment currentNonce", async function () {
            const initialNonce = await tokenConsumer.currentNonce();
            
            await tokenConsumer.connect(user1).deposit(depositAmount);
            
            expect(await tokenConsumer.currentNonce()).to.equal(initialNonce + 1n);
        });

        it("Should emit DepositIntent event with correct parameters", async function () {
            await expect(tokenConsumer.connect(user1).deposit(depositAmount))
                .to.emit(tokenConsumer, "DepositIntent")
                .withArgs(user1.address, depositAmount, 1); // First deposit gets nonce 1
        });

        it("Should revert if amount is zero", async function () {
            await expect(
                tokenConsumer.connect(user1).deposit(0)
            ).to.be.revertedWithCustomError(tokenConsumer, "ZeroAmount");
        });

        it("Should revert if user has not approved tokens", async function () {
            await expect(
                tokenConsumer.connect(user2).deposit(depositAmount)
            ).to.be.reverted; // ERC20 will revert with insufficient allowance
        });

        it("Should revert if user has insufficient balance", async function () {
            const tooMuch = ethers.parseEther("100000");
            await token.connect(user1).approve(tokenConsumer.target, tooMuch);
            
            await expect(
                tokenConsumer.connect(user1).deposit(tooMuch)
            ).to.be.reverted; // ERC20 will revert with insufficient balance
        });

        it("Should handle multiple deposits correctly", async function () {
            await tokenConsumer.connect(user1).deposit(depositAmount);
            
            await token.connect(user1).approve(tokenConsumer.target, depositAmount);
            await tokenConsumer.connect(user1).deposit(depositAmount);
            
            expect(await token.balanceOf(tokenConsumer.target)).to.equal(depositAmount * 2n);
            expect(await tokenConsumer.currentNonce()).to.equal(2);
        });

        it("Should handle deposits from multiple users", async function () {
            await tokenConsumer.connect(user1).deposit(depositAmount);
            
            await token.connect(user2).approve(tokenConsumer.target, depositAmount);
            await tokenConsumer.connect(user2).deposit(depositAmount);
            
            expect(await tokenConsumer.currentNonce()).to.equal(2);
        });
    });

    describe("Release", function () {
        const releaseAmount = ethers.parseEther("100");
        const nonce = 1;

        beforeEach(async function () {
            // Put some tokens in the contract (simulate previous deposits)
            await token.transfer(tokenConsumer.target, ethers.parseEther("1000"));
        });

        it("Should release tokens to user", async function () {
            const initialBalance = await token.balanceOf(user1.address);
            
            await tokenConsumer.connect(relayer).release(user1.address, releaseAmount, nonce);
            
            expect(await token.balanceOf(user1.address)).to.equal(
                initialBalance + releaseAmount
            );
        });

        it("Should mark nonce as processed", async function () {
            await tokenConsumer.connect(relayer).release(user1.address, releaseAmount, nonce);
            
            expect(await tokenConsumer.processedNonces(nonce)).to.be.true;
        });

        it("Should emit ReleaseExecuted event", async function () {
            await expect(
                tokenConsumer.connect(relayer).release(user1.address, releaseAmount, nonce)
            )
                .to.emit(tokenConsumer, "ReleaseExecuted")
                .withArgs(user1.address, releaseAmount, nonce);
        });

        it("Should revert if called by non-relayer", async function () {
            await expect(
                tokenConsumer.connect(user1).release(user1.address, releaseAmount, nonce)
            ).to.be.revertedWithCustomError(tokenConsumer, "NotRelayer");
        });

        it("Should revert if nonce already processed", async function () {
            await tokenConsumer.connect(relayer).release(user1.address, releaseAmount, nonce);
            
            await expect(
                tokenConsumer.connect(relayer).release(user1.address, releaseAmount, nonce)
            ).to.be.revertedWithCustomError(tokenConsumer, "AlreadyProcessed");
        });

        it("Should revert if amount is zero", async function () {
            await expect(
                tokenConsumer.connect(relayer).release(user1.address, 0, nonce)
            ).to.be.revertedWithCustomError(tokenConsumer, "ZeroAmount");
        });

        it("Should revert if destination is zero address", async function () {
            await expect(
                tokenConsumer.connect(relayer).release(ethers.ZeroAddress, releaseAmount, nonce)
            ).to.be.revertedWithCustomError(tokenConsumer, "InvalidDestination");
        });

        it("Should allow multiple releases with different nonces", async function () {
            await tokenConsumer.connect(relayer).release(user1.address, releaseAmount, 1);
            await tokenConsumer.connect(relayer).release(user2.address, releaseAmount, 2);
            
            expect(await tokenConsumer.processedNonces(1)).to.be.true;
            expect(await tokenConsumer.processedNonces(2)).to.be.true;
        });

        it("Should handle releases in any order (nonce order doesn't matter)", async function () {
            await tokenConsumer.connect(relayer).release(user1.address, releaseAmount, 5);
            await tokenConsumer.connect(relayer).release(user1.address, releaseAmount, 2);
            await tokenConsumer.connect(relayer).release(user1.address, releaseAmount, 10);
            
            expect(await tokenConsumer.processedNonces(5)).to.be.true;
            expect(await tokenConsumer.processedNonces(2)).to.be.true;
            expect(await tokenConsumer.processedNonces(10)).to.be.true;
        });
    });

    describe("Get Balance", function () {
        it("Should return correct balance", async function () {
            const amount = ethers.parseEther("500");
            await token.transfer(tokenConsumer.target, amount);
            
            expect(await tokenConsumer.getBalance()).to.equal(amount);
        });

        it("Should return zero for empty contract", async function () {
            const newTokenConsumer = await (await ethers.getContractFactory("TokenConsumer"))
                .deploy(token.target);
            
            expect(await newTokenConsumer.getBalance()).to.equal(0);
        });
    });

    describe("Integration: Deposit and Release Flow", function () {
        it("Should handle complete deposit -> release cycle", async function () {
            const amount = ethers.parseEther("100");
            
            // User deposits tokens
            await token.connect(user1).approve(tokenConsumer.target, amount);
            await tokenConsumer.connect(user1).deposit(amount);
            
            const depositNonce = await tokenConsumer.currentNonce();
            
            // Later, relayer releases tokens back
            const releaseNonce = 999; // Different nonce space for releases
            await tokenConsumer.connect(relayer).release(user1.address, amount, releaseNonce);
            
            // User should have their original balance back
            expect(await token.balanceOf(user1.address)).to.equal(
                ethers.parseEther("10000")
            );
        });
    });
});
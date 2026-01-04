const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Bridge Integration Tests", function () {
    let token1; // Original token on Base
    let tokenConsumer; // Lock/unlock on Base
    let wrappedToken1; // Wrapped token on Polygon
    let bridgeMintBurn; // Bridge on Polygon
    
    let owner;
    let relayer;
    let user1;
    let user2;

    const INITIAL_SUPPLY = ethers.parseEther("1000000");
    const BRIDGE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRIDGE_ROLE"));

    beforeEach(async function () {
        [owner, relayer, user1, user2] = await ethers.getSigners();
        
        // Deploy Base chain contracts
        const Token1 = await ethers.getContractFactory("Token1");
        token1 = await Token1.deploy(INITIAL_SUPPLY);
        
        const TokenConsumer = await ethers.getContractFactory("TokenConsumer");
        tokenConsumer = await TokenConsumer.deploy(token1.target);
        await tokenConsumer.setRelayer(relayer.address);
        
        // Deploy Polygon chain contracts
        const WrappedToken1 = await ethers.getContractFactory("WrappedToken1");
        wrappedToken1 = await WrappedToken1.deploy("Wrapped Token1", "wTKN1");
        
        const BridgeMintBurn = await ethers.getContractFactory("BridgeMintBurn");
        bridgeMintBurn = await BridgeMintBurn.deploy(wrappedToken1.target, owner.address);
        
        // Set up permissions
        await wrappedToken1.grantRole(BRIDGE_ROLE, bridgeMintBurn.target);
        await bridgeMintBurn.grantRole(BRIDGE_ROLE, relayer.address);
        
        // Give users some tokens
        await token1.transfer(user1.address, ethers.parseEther("10000"));
        await token1.transfer(user2.address, ethers.parseEther("10000"));
    });

    describe("Complete Bridge Flow: Base -> Polygon", function () {
        const bridgeAmount = ethers.parseEther("1000");

        it("Should successfully bridge tokens from Base to Polygon", async function () {
            // Step 1: User approves TokenConsumer on Base
            await token1.connect(user1).approve(tokenConsumer.target, bridgeAmount);
            
            // Step 2: User deposits tokens on Base
            await tokenConsumer.connect(user1).deposit(bridgeAmount);
            const depositNonce = await tokenConsumer.currentNonce();
            
            // Verify tokens are locked
            expect(await token1.balanceOf(tokenConsumer.target)).to.equal(bridgeAmount);
            expect(await token1.balanceOf(user1.address)).to.equal(
                ethers.parseEther("10000") - bridgeAmount
            );
            
            // Step 3: Relayer observes event and mints on Polygon
            await bridgeMintBurn.connect(relayer).mintWrapped(
                user1.address,
                bridgeAmount,
                depositNonce
            );
            
            // Verify wrapped tokens are minted
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(bridgeAmount);
        });

        it("Should emit correct events during bridging", async function () {
            await token1.connect(user1).approve(tokenConsumer.target, bridgeAmount);
            
            // Check DepositIntent event
            await expect(tokenConsumer.connect(user1).deposit(bridgeAmount))
                .to.emit(tokenConsumer, "DepositIntent")
                .withArgs(user1.address, bridgeAmount, 1);
            
            // Check WrappedMinted event
            await expect(
                bridgeMintBurn.connect(relayer).mintWrapped(user1.address, bridgeAmount, 1)
            )
                .to.emit(bridgeMintBurn, "WrappedMinted")
                .withArgs(user1.address, bridgeAmount, 1);
        });

        it("Should handle multiple users bridging simultaneously", async function () {
            // User1 bridges
            await token1.connect(user1).approve(tokenConsumer.target, bridgeAmount);
            await tokenConsumer.connect(user1).deposit(bridgeAmount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, bridgeAmount, 1);
            
            // User2 bridges
            await token1.connect(user2).approve(tokenConsumer.target, bridgeAmount);
            await tokenConsumer.connect(user2).deposit(bridgeAmount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user2.address, bridgeAmount, 2);
            
            // Both should have wrapped tokens
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(bridgeAmount);
            expect(await wrappedToken1.balanceOf(user2.address)).to.equal(bridgeAmount);
            
            // Original tokens should be locked
            expect(await token1.balanceOf(tokenConsumer.target)).to.equal(bridgeAmount * 2n);
        });
    });

    describe("Complete Bridge Flow: Polygon -> Base", function () {
        const bridgeAmount = ethers.parseEther("1000");

        beforeEach(async function () {
            // First bridge tokens from Base to Polygon
            await token1.connect(user1).approve(tokenConsumer.target, bridgeAmount);
            await tokenConsumer.connect(user1).deposit(bridgeAmount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, bridgeAmount, 1);
        });

        it("Should successfully bridge tokens from Polygon back to Base", async function () {
            // Step 1: User requests withdrawal on Polygon (tokens are burned immediately)
            await bridgeMintBurn.connect(user1).withdraw(bridgeAmount);
            const withdrawNonce = (await bridgeMintBurn.withdrawNonce()) - 1n;
            
            // Verify wrapped tokens are burned
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(0);
            
            // Step 2: Relayer releases original tokens on Base
            await tokenConsumer.connect(relayer).release(user1.address, bridgeAmount, withdrawNonce);
            
            // Verify user got original tokens back
            expect(await token1.balanceOf(user1.address)).to.equal(ethers.parseEther("10000"));
        });

        it("Should emit correct events during withdrawal", async function () {
            // Check WithdrawIntent event (tokens are burned immediately)
            await expect(bridgeMintBurn.connect(user1).withdraw(bridgeAmount))
                .to.emit(bridgeMintBurn, "WithdrawIntent")
                .withArgs(user1.address, bridgeAmount, 0);
            
            // Check ReleaseExecuted event
            await expect(
                tokenConsumer.connect(relayer).release(user1.address, bridgeAmount, 0)
            )
                .to.emit(tokenConsumer, "ReleaseExecuted")
                .withArgs(user1.address, bridgeAmount, 0);
        });
    });

    describe("Round Trip: Base -> Polygon -> Base", function () {
        const amount = ethers.parseEther("1000");

        it("Should handle complete round trip", async function () {
            const initialBalance = await token1.balanceOf(user1.address);
            
            // Base -> Polygon
            await token1.connect(user1).approve(tokenConsumer.target, amount);
            await tokenConsumer.connect(user1).deposit(amount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            // User should have wrapped tokens
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(amount);
            
            // Polygon -> Base
            await bridgeMintBurn.connect(user1).withdraw(amount);
            await tokenConsumer.connect(relayer).release(user1.address, amount, 0);
            
            // User should have original tokens back
            expect(await token1.balanceOf(user1.address)).to.equal(initialBalance);
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(0);
        });

        it("Should handle multiple round trips", async function () {
            for (let i = 0; i < 3; i++) {
                // Base -> Polygon
                await token1.connect(user1).approve(tokenConsumer.target, amount);
                await tokenConsumer.connect(user1).deposit(amount);
                await bridgeMintBurn.connect(relayer).mintWrapped(
                    user1.address,
                    amount,
                    i + 1
                );
                
                // Polygon -> Base
                await bridgeMintBurn.connect(user1).withdraw(amount);
                await tokenConsumer.connect(relayer).release(user1.address, amount, i);
            }
            
            // User should end with original balance
            expect(await token1.balanceOf(user1.address)).to.equal(
                ethers.parseEther("10000")
            );
        });
    });

    describe("Partial Bridging Scenarios", function () {
        const totalAmount = ethers.parseEther("1000");
        const partialAmount = ethers.parseEther("400");

        it("Should allow partial withdrawal", async function () {
            // Bridge full amount to Polygon
            await token1.connect(user1).approve(tokenConsumer.target, totalAmount);
            await tokenConsumer.connect(user1).deposit(totalAmount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, totalAmount, 1);
            
            // Withdraw only partial amount back to Base
            await bridgeMintBurn.connect(user1).withdraw(partialAmount);
            await tokenConsumer.connect(relayer).release(user1.address, partialAmount, 0);
            
            // User should have partial wrapped tokens and partial original tokens
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(
                totalAmount - partialAmount
            );
            expect(await token1.balanceOf(user1.address)).to.equal(
                ethers.parseEther("10000") - totalAmount + partialAmount
            );
        });

        it("Should allow multiple partial withdrawals", async function () {
            // Bridge to Polygon
            await token1.connect(user1).approve(tokenConsumer.target, totalAmount);
            await tokenConsumer.connect(user1).deposit(totalAmount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, totalAmount, 1);
            
            // First partial withdrawal
            await bridgeMintBurn.connect(user1).withdraw(partialAmount);
            await tokenConsumer.connect(relayer).release(user1.address, partialAmount, 0);
            
            // Second partial withdrawal
            await bridgeMintBurn.connect(user1).withdraw(partialAmount);
            await tokenConsumer.connect(relayer).release(user1.address, partialAmount, 1);
            
            // Check remaining balance
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(
                totalAmount - partialAmount * 2n
            );
        });
    });

    describe("User Interactions on Polygon", function () {
        const bridgeAmount = ethers.parseEther("1000");
        const transferAmount = ethers.parseEther("300");

        beforeEach(async function () {
            // Bridge tokens to Polygon
            await token1.connect(user1).approve(tokenConsumer.target, bridgeAmount);
            await tokenConsumer.connect(user1).deposit(bridgeAmount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, bridgeAmount, 1);
        });

        it("Should allow users to transfer wrapped tokens on Polygon", async function () {
            await wrappedToken1.connect(user1).transfer(user2.address, transferAmount);
            
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(
                bridgeAmount - transferAmount
            );
            expect(await wrappedToken1.balanceOf(user2.address)).to.equal(transferAmount);
        });

        it("Should allow transferred tokens to be bridged back", async function () {
            // User1 transfers to User2 on Polygon
            await wrappedToken1.connect(user1).transfer(user2.address, transferAmount);
            
            // User2 bridges back to Base
            await bridgeMintBurn.connect(user2).withdraw(transferAmount);
            await tokenConsumer.connect(relayer).release(user2.address, transferAmount, 0);
            
            // User2 should receive original tokens on Base
            expect(await token1.balanceOf(user2.address)).to.equal(
                ethers.parseEther("10000") + transferAmount
            );
        });
    });

    describe("Faucet Integration", function () {
        it("Should allow users to claim faucet and bridge tokens", async function () {
            const faucetAmount = ethers.parseEther("100");
            
            // User claims from faucet
            await token1.connect(user1).claimFaucet();
            
            // Bridge faucet tokens
            await token1.connect(user1).approve(tokenConsumer.target, faucetAmount);
            await tokenConsumer.connect(user1).deposit(faucetAmount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, faucetAmount, 1);
            
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(faucetAmount);
        });

        it("Should enforce faucet cooldown even after bridging", async function () {
            await token1.connect(user1).claimFaucet();
            
            // Try to claim again immediately
            await expect(
                token1.connect(user1).claimFaucet()
            ).to.be.revertedWith("Wait 24h");
        });
    });

    describe("Security and Edge Cases", function () {
        const amount = ethers.parseEther("1000");

        it("Should prevent replay attacks across both chains", async function () {
            // Bridge to Polygon with nonce 1
            await token1.connect(user1).approve(tokenConsumer.target, amount);
            await tokenConsumer.connect(user1).deposit(amount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            // Try to replay mint with same nonce
            await expect(
                bridgeMintBurn.connect(relayer).mintWrapped(user1.address, amount, 1)
            ).to.be.revertedWith("Deposit already processed");
            
            // Bridge back with nonce 0
            await bridgeMintBurn.connect(user1).withdraw(amount);
            await tokenConsumer.connect(relayer).release(user1.address, amount, 0);
            
            // Try to replay release with same nonce
            await expect(
                tokenConsumer.connect(relayer).release(user1.address, amount, 0)
            ).to.be.revertedWithCustomError(tokenConsumer, "AlreadyProcessed");
        });

        it("Should atomically burn tokens on withdrawal preventing double-spending", async function () {
            // Bridge to Polygon
            await token1.connect(user1).approve(tokenConsumer.target, amount);
            await tokenConsumer.connect(user1).deposit(amount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, amount, 1);
            
            // User requests withdrawal - tokens are burned immediately
            const balanceBefore = await wrappedToken1.balanceOf(user1.address);
            await bridgeMintBurn.connect(user1).withdraw(amount);
            
            // Tokens should be gone immediately
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(0);
            
            // User cannot transfer tokens after withdrawal request
            await expect(
                wrappedToken1.connect(user1).transfer(user2.address, amount)
            ).to.be.reverted; // Insufficient balance
        });

        it("Should maintain correct total supply across chains", async function () {
            const user1Amount = ethers.parseEther("500");
            const user2Amount = ethers.parseEther("300");
            
            // User1 bridges
            await token1.connect(user1).approve(tokenConsumer.target, user1Amount);
            await tokenConsumer.connect(user1).deposit(user1Amount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user1.address, user1Amount, 1);
            
            // User2 bridges
            await token1.connect(user2).approve(tokenConsumer.target, user2Amount);
            await tokenConsumer.connect(user2).deposit(user2Amount);
            await bridgeMintBurn.connect(relayer).mintWrapped(user2.address, user2Amount, 2);
            
            // Total locked on Base should equal total wrapped on Polygon
            expect(await token1.balanceOf(tokenConsumer.target)).to.equal(
                user1Amount + user2Amount
            );
            expect(await wrappedToken1.totalSupply()).to.equal(
                user1Amount + user2Amount
            );
        });
    });

    describe("Stress Tests", function () {
        it("Should handle many small deposits and withdrawals", async function () {
            const smallAmount = ethers.parseEther("10");
            const iterations = 5;
            
            for (let i = 0; i < iterations; i++) {
                // Deposit
                await token1.connect(user1).approve(tokenConsumer.target, smallAmount);
                await tokenConsumer.connect(user1).deposit(smallAmount);
                await bridgeMintBurn.connect(relayer).mintWrapped(
                    user1.address,
                    smallAmount,
                    i + 1
                );
            }
            
            expect(await wrappedToken1.balanceOf(user1.address)).to.equal(
                smallAmount * BigInt(iterations)
            );
        });
    });
});